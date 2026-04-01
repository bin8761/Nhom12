import type { Redis } from 'ioredis';
import { AppConfig, loadAppConfig } from '../config/appConfig';
import { getRedisClient, initRedisClient, shutdownRedisClient } from '../infra/redis/redisClient';

export interface AppContext {
  config: AppConfig;
  redis: Redis;
}

let contextPromise: Promise<AppContext> | null = null;

export async function bootstrapAppContext(): Promise<AppContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const config = loadAppConfig();
      const redis = await initRedisClient();

      return { config, redis } satisfies AppContext;
    })();
  }

  return contextPromise;
}

export function getRedisConnection(): Redis {
  return getRedisClient();
}

export async function shutdownAppContext(): Promise<void> {
  contextPromise = null;
  await shutdownRedisClient();
}
