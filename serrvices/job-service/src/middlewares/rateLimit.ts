import type { Request, RequestHandler, Response } from 'express';
import { getRedisConnection } from '../container/appContext';
import { loadAppConfig } from '../config/appConfig';
import { recordJobRateLimitHit } from '../metrics/jobMetrics';

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
        recordJobRateLimitHit(options.namespace);
        return res.status(429).json(RATE_LIMIT_ERROR_BODY satisfies Record<string, unknown>);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const jobPostRateLimiter = (() => {
  const config = loadAppConfig();
  return createRateLimitMiddleware({
    keyResolver: (req) => {
      const userId = typeof (req as any).user?.id === 'string' ? (req as any).user.id : null;
      return userId ?? null;
    },
    limit: config.jobRateLimit.maxSubmissions,
    windowSeconds: config.jobRateLimit.windowMinutes * 60,
    namespace: 'job-post',
  });
})();

export const publicSearchRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null,
  limit: 120, // Increased from 60 to 120
  windowSeconds: 60,
  namespace: 'job-search',
});

export const candidateRecommendationRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => {
    const userId = typeof (req as any).user?.id === 'string' ? (req as any).user.id : null;
    return userId;
  },
  limit: 60, // Increased from 30 to 60
  windowSeconds: 60,
  namespace: 'candidate-recommendation',
});

