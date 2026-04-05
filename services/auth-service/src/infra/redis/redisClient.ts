import Redis, { RedisOptions } from 'ioredis';
import { loadAppConfig } from '../../config/appConfig';

let redisClient: Redis | null = null;

export interface RedisConnectionOptions extends RedisOptions {}

export async function initRedisClient(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  const { redis } = loadAppConfig();

  redisClient = new Redis(redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redisClient.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      // TODO: migrate to structured logger when available.
      console.error('[Redis] connection error', error);
    }
  });

  await redisClient.ping();

  return redisClient;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client has not been initialised. Call initRedisClient() before using it.');
  }

  return redisClient;
}

export function duplicateRedisConnection(redis: Redis): Redis {
  return redis.duplicate({
    enableReadyCheck: false,
  });
}

export async function shutdownRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
}
