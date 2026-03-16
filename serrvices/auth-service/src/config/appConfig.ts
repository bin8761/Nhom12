import { validateEnv } from './envValidation';

export interface RateLimitConfig {
  loginPerMinute: number;
}

export interface AuthTokenConfig {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

export interface JwtConfig {
  issuer: string;
  audience: string;
  algorithm: 'RS256' | 'RS384' | 'RS512';
  privateKey?: string;
  publicKey?: string;
}

export interface AppConfig {
  rateLimit: RateLimitConfig;
  authTokens: AuthTokenConfig;
  jwt: JwtConfig;
  redis: { url: string };
}

function readNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAppConfig(): AppConfig {
  const env = validateEnv();

  return {
    rateLimit: {
      loginPerMinute: readNumber(env.AUTH_RATE_LIMIT_LOGIN_PER_MIN, 10),
    },
    authTokens: {
      accessTokenTtlSeconds: readNumber(env.AUTH_ACCESS_TTL_SECONDS, 900),
      refreshTokenTtlDays: readNumber(env.AUTH_REFRESH_TTL_DAYS, 30),
    },
    jwt: {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: env.JWT_ALGORITHM,
      privateKey: env.JWT_PRIVATE_KEY,
      publicKey: env.JWT_PUBLIC_KEY,
    },
    redis: { url: env.REDIS_URL },
  };
}
