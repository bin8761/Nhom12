import type { Request, RequestHandler } from 'express';
import { getRedisConnection } from '../container/appContext';
import { recordJobRateLimitHit } from '../metrics/jobMetrics';

export interface RateLimitOptions {
  keyResolver: (req: Request) => string | null;
  limit: number;
  windowSeconds: number;
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

export const publicSearchRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null,
  limit: 120,
  windowSeconds: 60,
  namespace: 'job-search',
});
