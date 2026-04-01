import type { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import { isServiceError } from '../utils/errors';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  logger.error({
    event: 'http_request_error',
    method: req.method,
    url: req.originalUrl,
    statusCode: isServiceError(err) ? err.statusCode : 500,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  if (res.headersSent) {
    next(err);
    return;
  }

  if (isServiceError(err)) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  res.status(500).json({
    code: 'ERR_INTERNAL',
    message: 'Lỗi máy chủ nội bộ',
  });
}
