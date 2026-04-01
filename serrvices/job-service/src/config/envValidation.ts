import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JOB_SEARCH_CACHE_TTL_SECONDS: z.string().default('60'),
  FRONTEND_URL: z.string().optional(),
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
  console.info('[Env] JOB_SEARCH_CACHE_TTL_SECONDS:', env.JOB_SEARCH_CACHE_TTL_SECONDS);
}
