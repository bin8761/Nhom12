import { validateEnv } from './envValidation';

export interface SearchCacheConfig {
  ttlSeconds: number;
}

export interface AppConfig {
  redis: { url: string };
  searchCache: SearchCacheConfig;
}

function readNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAppConfig(): AppConfig {
  const env = validateEnv();

  return {
    redis: { url: env.REDIS_URL },
    searchCache: {
      ttlSeconds: readNumber(env.JOB_SEARCH_CACHE_TTL_SECONDS, 60),
    },
  };
}
