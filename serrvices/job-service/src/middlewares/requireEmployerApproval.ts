import type { NextFunction, Request, Response } from 'express';

interface AuthenticatedUser {
  role?: string;
  approvalStatus?: string;
}

export function requireEmployerApproval() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    if (String(user.role ?? '').toUpperCase() !== 'EMPLOYER') {
      res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Employer role required' });
      return;
    }

    if (String(user.approvalStatus ?? '').toUpperCase() !== 'APPROVED') {
      res.status(403).json({
        code: 'ERR_EMPLOYER_NOT_APPROVED',
        message: 'Employer account must be approved to access this resource',
      });
      return;
    }

    next();
  };
}
