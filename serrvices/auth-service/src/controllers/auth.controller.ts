import type { NextFunction, Request, Response } from 'express';
import {
  authTokensResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  meResponseSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resendPhoneOtpRequestSchema,
  verifyEmailRequestSchema,
  verifyPhoneRequestSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type MeResponse,
} from '../schemas/authSchemas';
import * as authService from '../services/auth.service';
import { isServiceError } from '../utils/errors';
import logger from '../utils/logger';

const VALIDATION_ERROR_CODE = 'ERR_VALIDATION';
const VALIDATION_ERROR_MESSAGE = 'Invalid request payload';

type RequestWithUserContext = Request & {
  user?: Partial<MeResponse>;
};

function sendValidationError(
  req: Request,
  res: Response,
  details: { path: string; message: string }[],
) {
  logger.warn({
    event: 'auth_validation_failed',
    path: req.path,
    method: req.method,
    details,
  });
  res.status(400).json({
    code: VALIDATION_ERROR_CODE,
    message: VALIDATION_ERROR_MESSAGE,
    details,
  });
}

function trySendServiceError(req: Request, res: Response, error: unknown): boolean {
  if (!isServiceError(error)) {
    return false;
  }

  logger.warn({
    event: 'auth_service_error',
    path: req.path,
    method: req.method,
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
    message: error.message,
  });

  res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
    details: error.details,
  });

  return true;
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await registerRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendValidationError(req, res, details);
    return;
  }

  try {
    const locale = req.acceptsLanguages()?.[0] ?? null;
    const tokens = await authService.register(parseResult.data, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      locale,
    });
    const responseBody = authTokensResponseSchema.parse(tokens);

    res.status(201).json({ data: responseBody });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await loginRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendValidationError(req, res, details);
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    const tokens = await authService.login(parseResult.data, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      requestId,
    });
    const responseBody = authTokensResponseSchema.parse(tokens);

    res.status(200).json({ data: responseBody });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await refreshRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendValidationError(req, res, details);
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    const tokens = await authService.refresh(parseResult.data, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      requestId,
    });
    const responseBody = authTokensResponseSchema.parse(tokens);

    res.status(200).json({ data: responseBody });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await logoutRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendValidationError(req, res, details);
    return;
  }

  const currentUser = (req as RequestWithUserContext).user;
  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    await authService.logout(parseResult.data, {
      userId: currentUser.id,
      userEmail: currentUser.email ?? null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      requestId,
    });

    res.status(204).send();
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await resendVerificationRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendValidationError(req, res, details);
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    const locale = req.acceptsLanguages()?.[0] ?? null;
    await authService.resendVerification(parseResult.data, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      locale,
      requestId,
    });

    res.status(202).json({ data: { message: 'Verification email scheduled' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await verifyEmailRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  try {
    await authService.verifyEmail(parseResult.data);
    res.status(200).json({ data: { message: 'Email verified' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  const currentUser = (req as RequestWithUserContext).user;

  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  try {
    const profile = await authService.getCurrentUserProfile(currentUser.id);
    const responseBody = meResponseSchema.parse(profile);

    res.status(200).json({ data: responseBody });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }

    next(error);
  }
}

export async function verifyPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await verifyPhoneRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  const currentUser = (req as RequestWithUserContext).user;
  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    await authService.verifyPhone(parseResult.data, { userId: currentUser.id, requestId });
    res.status(200).json({ data: { message: 'Phone verified' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}

export async function resendPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await resendPhoneOtpRequestSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  const currentUser = (req as RequestWithUserContext).user;
  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    await authService.resendPhoneVerification(parseResult.data, { userId: currentUser.id, requestId });
    res.status(202).json({ data: { message: 'Phone verification code resent' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await changePasswordSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  const currentUser = (req as RequestWithUserContext).user;
  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    await authService.changePassword(
      { userId: currentUser.id, requestId },
      parseResult.data.currentPassword,
      parseResult.data.newPassword,
    );
    res.status(200).json({ data: { message: 'Password updated' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await forgotPasswordSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    const locale = req.acceptsLanguages()?.[0] ?? null;
    await authService.requestPasswordReset(parseResult.data, { requestId, locale });
    res.status(202).json({ data: { message: 'Password reset code sent if the email exists' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parseResult = await resetPasswordSchema.safeParseAsync(req.body);

  if (!parseResult.success) {
    const details = parseResult.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendValidationError(req, res, details);
    return;
  }

  try {
    const requestId = req.get('x-request-id') ?? null;
    await authService.resetPassword(parseResult.data, { requestId });
    res.status(200).json({ data: { message: 'Password reset successful' } });
  } catch (error) {
    if (trySendServiceError(req, res, error)) {
      return;
    }
    next(error);
  }
}
