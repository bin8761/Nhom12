import type { NextFunction, Request, Response } from 'express';
import { loadAppConfig } from '../config/appConfig';

const INTERNAL_HEADER = 'x-internal-secret';
const config = loadAppConfig();

export function verifyInternalSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provided = req.get(INTERNAL_HEADER);
  if (!provided || provided !== config.internalApi.secret) {
    res.status(401).json({
      code: 'ERR_INTERNAL_UNAUTHORIZED',
      message: 'Unauthorized internal request',
    });
    return;
  }
  next();
}
