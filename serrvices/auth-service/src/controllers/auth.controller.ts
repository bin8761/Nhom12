import type { NextFunction, Request, Response } from 'express';
import { authTokensResponseSchema, loginRequestSchema } from '../schemas/authSchemas';
import * as authService from '../services/auth.service';
import { isServiceError } from '../utils/errors';
import logger from '../utils/logger';

const VALIDATION_ERROR_CODE = 'ERR_VALIDATION';
const VALIDATION_ERROR_MESSAGE = 'Invalid request payload';

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
