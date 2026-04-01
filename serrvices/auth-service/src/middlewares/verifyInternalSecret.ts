import type { Request, Response, NextFunction } from 'express';

export function verifyInternalSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-internal-secret';

  if (secret !== expectedSecret) {
    res.status(403).json({
      code: 'ERR_FORBIDDEN',
      message: 'Invalid internal secret',
    });
    return;
  }

  next();
}
