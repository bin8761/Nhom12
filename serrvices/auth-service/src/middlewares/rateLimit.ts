import type { Request, RequestHandler, Response } from 'express';
import { getRedisConnection } from '../container/appContext';
import { loadAppConfig } from '../config/appConfig';

export interface RateLimitOptions {
  /** Key that differentiates callers (e.g., IP, email). Return null to skip limiting. */
  keyResolver: (req: Request) => string | null;
  /** Maximum number of requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Identifier to include in Redis key namespace. */
  namespace: string;
}

const RATE_LIMIT_ERROR_BODY = {
  code: 'ERR_RATE_LIMIT',
  message: 'Too many requests. Please try again later.',
};

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const keySuffix = options.keyResolver(req);
      if (!keySuffix) {
        return next();
      }

      const redis = getRedisConnection();
      const redisKey = `rate:${options.namespace}:${keySuffix}`;

      const currentCount = await redis.incr(redisKey);
      if (currentCount === 1) {
        await redis.expire(redisKey, options.windowSeconds);
      }

      if (currentCount > options.limit) {
        const retryAfter = await redis.ttl(redisKey);
        if (retryAfter > 0) {
          res.setHeader('Retry-After', retryAfter);
        }
        return res.status(429).json(RATE_LIMIT_ERROR_BODY satisfies Record<string, unknown>);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const config = loadAppConfig();

export const registerRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => req.ip,
  limit: config.rateLimit.registerPerMinute,
  windowSeconds: 60,
  namespace: 'auth-register-ip',
});

export const loginRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => req.ip,
  limit: config.rateLimit.loginPerMinute,
  windowSeconds: 60,
  namespace: 'auth-login-ip',
});

export const resendVerificationRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    return email && email.length > 0 ? email : null;
  },
  limit: config.rateLimit.resendPerHour,
  windowSeconds: 60 * 60,
  namespace: 'auth-resend-email',
});

export const resendPhoneOtpRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => {
    const userId = typeof (req as any).user?.id === 'string' ? (req as any).user.id : null;
    return userId && userId.length > 0 ? userId : null;
  },
  limit: config.rateLimit.phoneOtpPerHour,
  windowSeconds: 60 * 60,
  namespace: 'auth-resend-phone',
});

export const passwordResetRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    return email && email.length > 0 ? email : null;
  },
  limit: 5,
  windowSeconds: 10 * 60,
  namespace: 'auth-password-reset',
});
