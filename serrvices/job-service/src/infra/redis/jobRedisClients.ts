import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { loadAppConfig } from '../../config/appConfig';

let rateLimitRedis: Redis | null = null;
let bullQueueRedis: Redis | null = null;

function createRedisClient(options?: { keyPrefix?: string }): Redis {
  const {
    redis: { url },
  } = loadAppConfig();

  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (options?.keyPrefix) {
    redisOptions.keyPrefix = `${options.keyPrefix}:`;
  }

  return new Redis(url, redisOptions);
}

export async function initRateLimitRedis(): Promise<Redis> {
  if (rateLimitRedis) {
    return rateLimitRedis;
  }

  const {
    redis: {
      namespaces: { rateLimit },
    },
  } = loadAppConfig();

  rateLimitRedis = createRedisClient({ keyPrefix: rateLimit });

  rateLimitRedis.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Redis] rate limiter client error', error);
    }
  });

  await rateLimitRedis.ping();

  return rateLimitRedis;
}

export function getRateLimitRedis(): Redis {
  if (!rateLimitRedis) {
    throw new Error('Rate-limit Redis client not initialised');
  }
  return rateLimitRedis;
}

export async function shutdownRateLimitRedis(): Promise<void> {
  if (!rateLimitRedis) {
    return;
  }
  await rateLimitRedis.quit();
  rateLimitRedis = null;
}

export async function initBullQueueRedis(): Promise<Redis> {
  if (bullQueueRedis) {
    return bullQueueRedis;
  }

  const {
    redis: {
      namespaces: { queues },
    },
  } = loadAppConfig();

  bullQueueRedis = createRedisClient();

  bullQueueRedis.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Redis] bull queue client error', error);
    }
  });

  await bullQueueRedis.ping();

  return bullQueueRedis;
}

export function getBullQueueRedis(): Redis {
  if (!bullQueueRedis) {
    throw new Error('Bull queue Redis client not initialised');
  }
  return bullQueueRedis;
}

export async function shutdownBullQueueRedis(): Promise<void> {
  if (!bullQueueRedis) {
    return;
  }
  await bullQueueRedis.quit();
  bullQueueRedis = null;
}

export function duplicateRedisConnection(redis: Redis): Redis {
  return redis.duplicate({
    enableReadyCheck: false,
  });
}
