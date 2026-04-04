import type { NextFunction, Request, Response } from 'express';
import { listCandidateApplications, getApplicationDetails } from '../services/application.service';
import { isServiceError } from '../utils/errors';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * List all applications for current candidate - GET /api/candidates/me/applications
 */
export async function listMyApplicationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (req as RequestWithUser).user;
    if (!currentUser?.id) {
      res.status(401).json({ 
        code: 'ERR_UNAUTHORIZED', 
        message: 'Access token required' 
      });
      return;
    }

    const page = Math.max(
      1,
      parseInt(String(req.query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE,
    );
    const limit = Math.min(
      Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT,
    );

    const result = await listCandidateApplications({
      candidateId: currentUser.id,
      page,
      limit,
    });

    res.status(200).json({
      data: result.data,
      meta: result.pagination,
    });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}

/**
 * Get application details - GET /api/candidates/me/applications/:applicationId
 */
export async function getMyApplicationDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (req as RequestWithUser).user;
    if (!currentUser?.id) {
      res.status(401).json({ 
        code: 'ERR_UNAUTHORIZED', 
        message: 'Access token required' 
      });
      return;
    }

    const applicationId = req.params.applicationId;
    if (!applicationId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'applicationId is required',
      });
      return;
    }

    const application = await getApplicationDetails(applicationId);

    // Verify this application belongs to current candidate
    if (application.candidateId !== currentUser.id) {
      res.status(403).json({
        code: 'ERR_FORBIDDEN',
        message: 'You can only view your own applications',
      });
      return;
    }

    res.status(200).json({
      data: application,
    });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}

/**
 * Withdraw application - DELETE /api/candidates/me/applications/:applicationId
 */
export async function withdrawMyApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = (req as RequestWithUser).user;
    if (!currentUser?.id) {
      res.status(401).json({ 
        code: 'ERR_UNAUTHORIZED', 
        message: 'Access token required' 
      });
      return;
    }

    const applicationId = req.params.applicationId;
    if (!applicationId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'applicationId is required',
      });
      return;
    }

    const { withdrawApplication } = await import('../services/application.service');
    await withdrawApplication(applicationId, currentUser.id);

    res.status(200).json({
      message: 'Application withdrawn successfully',
    });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
      return;
    }
    next(error);
  }
}
