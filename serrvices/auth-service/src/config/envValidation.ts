import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ALGORITHM: z.enum(['RS256', 'RS384', 'RS512']).default('RS256'),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  AUTH_ACCESS_TTL_SECONDS: z.string().default('900'),
  AUTH_REFRESH_TTL_DAYS: z.string().default('30'),
  AUTH_RATE_LIMIT_LOGIN_PER_MIN: z.string().default('10'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export function printEnvSummary(env: Env): void {
  console.info('[Env] NODE_ENV:', env.NODE_ENV);
  console.info('[Env] PORT:', env.PORT ?? '(default)');
  console.info('[Env] DATABASE_URL: configured');
  console.info('[Env] REDIS_URL: configured');
  console.info('[Env] JWT_ISSUER:', env.JWT_ISSUER);
  console.info('[Env] JWT_AUDIENCE:', env.JWT_AUDIENCE);
  console.info('[Env] JWT_ALGORITHM:', env.JWT_ALGORITHM);
}
