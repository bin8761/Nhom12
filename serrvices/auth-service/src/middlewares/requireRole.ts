import type { NextFunction, Request, Response } from 'express';

export function requireRole(allowedRoles: string[]): (req: Request, res: Response, next: NextFunction) => void {
  const normalized = allowedRoles.map((role) => role.toUpperCase());

  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).user?.role;

    if (!userRole) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    if (!normalized.includes(String(userRole).toUpperCase())) {
      res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
