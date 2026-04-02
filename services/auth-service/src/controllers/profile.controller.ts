import type { NextFunction, Request, Response } from 'express';
import {
  candidateProfileRequestSchema,
  candidateProfileResponseSchema,
  employerProfileRequestSchema,
  employerProfileResponseSchema,
  profileResponseSchema,
  type CandidateProfileRequestInput,
  type EmployerProfileRequestInput,
} from '../schemas/profile.schema';
import { isServiceError } from '../utils/errors';
import {
  getProfileByUserId,
  upsertCandidateProfile,
  upsertEmployerProfile,
  type ProfileFetchResult,
} from '../services/profile.service';
import { recordProfileFetch, recordProfileUpdate } from '../metrics/profileMetrics';
import logger from '../utils/logger';

const VALIDATION_ERROR_CODE = 'ERR_VALIDATION';
const VALIDATION_ERROR_MESSAGE = 'Invalid request payload';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    role?: string;
    emailVerified?: boolean;
  };
}

function sendValidationError(res: Response, details: { path: string; message: string }[]): void {
  res.status(400).json({
    code: VALIDATION_ERROR_CODE,
    message: VALIDATION_ERROR_MESSAGE,
    details,
  });
}

function trySendServiceError(res: Response, error: unknown): boolean {
  if (!isServiceError(error)) {
    return false;
  }

  res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
    details: error.details,
  });

  return true;
}

function mapProfileToResponse(result: ProfileFetchResult) {
  return profileResponseSchema.parse(result);
}

export async function getMyProfile(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
  const currentUser = req.user;

  if (!currentUser?.id) {
    logger.warn({
      event: 'profile_get_failed',
      reason: 'missing_user_context',
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    recordProfileFetch('CANDIDATE', 'forbidden');
    return;
  }

  try {
    const profile = await getProfileByUserId(currentUser.id);
    const responseBody = mapProfileToResponse(profile);
    res.status(200).json({ data: responseBody });
    logger.info({
      event: 'profile_get_success',
      userId: currentUser.id,
      role: profile.role,
    });
  } catch (error) {
    recordProfileFetch('CANDIDATE', 'error');
    if (trySendServiceError(res, error)) {
      logger.warn({
        event: 'profile_get_failed',
        reason: 'service_error',
        userId: currentUser.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    next(error);
  }
}

export async function updateMyProfile(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
  const currentUser = req.user;
  const start = Date.now();

  if (!currentUser?.id || !currentUser.role) {
    logger.warn({
      event: 'profile_update_failed',
      reason: 'missing_user_context',
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    recordProfileUpdate('CANDIDATE', 'error', 0);
    return;
  }

  const role = currentUser.role.toUpperCase();

  if (role !== 'CANDIDATE' && role !== 'EMPLOYER') {
    logger.warn({
      event: 'profile_update_failed',
      reason: 'role_not_supported',
      path: req.path,
      method: req.method,
      userId: currentUser.id,
      role: currentUser.role,
    });
    res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Profile update unsupported for this role' });
    recordProfileUpdate(role === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE', 'error', 0);
    return;
  }

  const schema = role === 'CANDIDATE' ? candidateProfileRequestSchema : employerProfileRequestSchema;
  
  logger.info({
    event: 'profile_update_request',
    userId: currentUser.id,
    role,
    body: req.body,
  });

  // If body is empty, return current profile without updating
  if (!req.body || Object.keys(req.body).length === 0) {
    logger.info({
      event: 'profile_update_noop',
      userId: currentUser.id,
      role,
      reason: 'empty_body',
    });
    
    const profile = await getProfileByUserId(currentUser.id);
    res.status(200).json({
      data: {
        profile: profile.profile,
        changedFields: [],
        updatedAt: profile.profile.updatedAt,
      },
    });
    recordProfileUpdate(role as 'CANDIDATE' | 'EMPLOYER', 'noop', (Date.now() - start) / 1000);
    return;
  }
  
  const parseResult = await schema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    logger.error({
      event: 'profile_update_validation_failed',
      userId: currentUser.id,
      role,
      body: req.body,
      errors: parseResult.error.issues,
      details,
    });

    sendValidationError(res, details);
    logger.warn({
      event: 'profile_update_failed',
      reason: 'validation_error',
      path: req.path,
      method: req.method,
      userId: currentUser.id,
      role,
      details,
    });
    recordProfileUpdate(role as 'CANDIDATE' | 'EMPLOYER', 'error', 0);
    return;
  }

  try {
    const result =
      role === 'CANDIDATE'
        ? await upsertCandidateProfile({
            userId: currentUser.id,
            actorId: currentUser.id,
            payload: parseResult.data as CandidateProfileRequestInput,
          })
        : await upsertEmployerProfile({
            userId: currentUser.id,
            actorId: currentUser.id,
            payload: parseResult.data as EmployerProfileRequestInput,
          });

    const responseSchema = role === 'CANDIDATE' ? candidateProfileResponseSchema : employerProfileResponseSchema;
    const responseBody = responseSchema.parse(result.profile);
    const status = result.changedFields.length === 0 ? 'noop' : 'success';
    recordProfileUpdate(role as 'CANDIDATE' | 'EMPLOYER', status, (Date.now() - start) / 1000);

    res.status(200).json({
      data: {
        profile: responseBody,
        changedFields: result.changedFields,
        updatedAt: result.updatedAt,
      },
    });
    logger.info({
      event: 'profile_update_success',
      userId: currentUser.id,
      role,
      changedFields: result.changedFields,
      status,
    });
  } catch (error) {
    recordProfileUpdate(role as 'CANDIDATE' | 'EMPLOYER', 'error', (Date.now() - start) / 1000);
    if (trySendServiceError(res, error)) {
      logger.warn({
        event: 'profile_update_failed',
        reason: 'service_error',
        path: req.path,
        method: req.method,
        userId: currentUser.id,
        role,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    next(error);
  }
}

export async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await getProfileByUserId(req.params.userId);
    const responseBody = mapProfileToResponse(profile);
    res.status(200).json({ data: responseBody });
    logger.info({
      event: 'profile_admin_get_success',
      adminId: (req as any).user?.id,
      targetUserId: req.params.userId,
      role: profile.role,
    });
  } catch (error) {
    if (trySendServiceError(res, error)) {
      logger.warn({
        event: 'profile_admin_get_failed',
        adminId: (req as any).user?.id,
        targetUserId: req.params.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    next(error);
  }
}


/**
 * Get public user profile (for chat display names)
 * Returns minimal public info: company name or full name
 */
export async function getPublicUserProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ code: 'ERR_VALIDATION', message: 'User ID is required' });
    return;
  }

  try {
    const profile = await getProfileByUserId(userId);

    // Return public info based on role
    const publicData: any = {
      email: profile.email, // Email đăng nhập
    };

    if (profile.role === 'EMPLOYER') {
      publicData.employerProfile = {
        companyName: profile.profile.companyName || null,
        companyWebsite: profile.profile.companyWebsite || null,
        contactEmail: profile.profile.contactEmail || null,
        phone: profile.profile.contactPhone || null, // Đúng field name
        address: profile.profile.headquartersLocation || null, // Đúng field name
        website: profile.profile.companyWebsite || null, // Alias for consistency
      };
    } else if (profile.role === 'CANDIDATE') {
      publicData.candidateProfile = {
        fullName: profile.profile.fullName || null,
      };
    }

    res.status(200).json({ data: publicData });
  } catch (error) {
    if (trySendServiceError(res, error)) {
      return;
    }

    logger.error({
      event: 'public_profile_fetch_failed',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      code: 'ERR_INTERNAL',
      message: 'Failed to fetch public profile',
    });
  }
}
