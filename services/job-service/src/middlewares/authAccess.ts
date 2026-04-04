import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadAppConfig } from '../config/appConfig';
import { resolvePublicKey } from '../utils/tokenGenerator';
import logger from '../utils/logger';

export function authAccess(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.get('authorization') || req.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({
        event: 'auth_access_failed',
        reason: 'missing_bearer_token',
        path: req.path,
        method: req.method,
      });
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const config = loadAppConfig();
    const publicKey = resolvePublicKey();
    if (!publicKey) {
      logger.warn({
        event: 'auth_access_failed',
        reason: 'public_key_unavailable',
        path: req.path,
        method: req.method,
      });
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Token verification key unavailable' });
      return;
    }

    const payload = jwt.verify(token, publicKey, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as Record<string, unknown>;

    if (payload.tokenUse !== 'access') {
      logger.warn({
        event: 'auth_access_failed',
        reason: 'invalid_token_use',
        path: req.path,
        method: req.method,
      });
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Invalid token use' });
      return;
    }

    // attach minimal user context for controllers
    (req as any).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      emailVerified: payload.emailVerified,
      approvalStatus: payload.approvalStatus,
    };

    logger.info({
      event: 'auth_access_granted',
      path: req.path,
      method: req.method,
      userId: payload.sub,
      role: payload.role,
    });

    next();
  } catch (error) {
    logger.warn({
      event: 'auth_access_failed',
      reason: 'invalid_or_expired_token',
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Invalid or expired access token' });
  }
}
