import { z } from 'zod';

/**
 * Environment variables schema for Job Service
 * This validates all required and optional environment variables at startup
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default('4002'),

  // Database
  DATABASE_URL: z.string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (url) => url.startsWith('mysql://') || url.startsWith('postgresql://'),
      'DATABASE_URL must be a valid MySQL or PostgreSQL connection string'
    ),

  // Redis
  REDIS_URL: z.string()
    .min(1, 'REDIS_URL is required')
    .refine(
      (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
      'REDIS_URL must start with redis:// or rediss://'
    ),
  REDIS_RATE_LIMIT_NAMESPACE: z.string().default('job-post-rate'),
  REDIS_QUEUE_NAMESPACE: z.string().default('job-post-queue'),

  // JWT Keys (for verifying tokens from auth service)
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('auth-service'),
  JWT_AUDIENCE: z.string().default('job-finder-clients'),

  // Token TTLs
  ACCESS_TOKEN_TTL_SECONDS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(60).max(3600))
    .default('900'),
  REFRESH_TOKEN_TTL_DAYS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(90))
    .default('30'),

  // Storage
  JOB_IMAGES_DIR: z.string().default('storage/job-images'),
  CV_STORAGE_DIR: z.string().default('storage/cv-library'),
  CV_MAX_FILES_PER_CANDIDATE: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(20))
    .default('5'),
  CV_MAX_FILE_SIZE_BYTES: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1024).max(52428800))
    .default('10485760'),
  CV_ALLOWED_MIME_TYPES: z.string().default('application/pdf'),
  CV_SIGNED_URL_TTL_SECONDS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(60).max(3600))
    .default('300'),
  CV_SIGNING_SECRET: z.string().min(1, 'CV_SIGNING_SECRET is required'),

  // OCR Settings
  OCR_PROVIDER: z.enum(['tesseract', 'none']).default('tesseract'),
  TESSERACT_LANG: z.string().default('eng'),
  OCR_DPI: z.string()
    .transform(Number)
    .pipe(z.number().int().min(72).max(600))
    .default('220'),

  // BullMQ / Queues
  JOB_APPROVAL_QUEUE: z.string().default('jobApprovalQueue'),
  CV_PROCESSING_QUEUE: z.string().default('cvProcessingQueue'),
  CV_DLQ: z.string().default('cvProcessingQueue.dlq'),
  BULLMQ_PREFIX: z.string().default('job-service'),

  // Rate Limiting
  JOB_RATE_LIMIT_MAX: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(1000))
    .default('5'),
  JOB_RATE_LIMIT_WINDOW_MINUTES: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(1440))
    .default('10'),

  // Email / SMTP
  MAIL_SENDER: z.string().email().default('no-reply@bonenet.local'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default('1025'),
  SMTP_SECURE: z.string()
    .transform((val) => val === 'true')
    .default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@bonenet.local'),

  // Event Bus
  EVENT_BUS_URL: z.string()
    .refine(
      (url) => url.startsWith('nats://'),
      'EVENT_BUS_URL must start with nats://'
    )
    .default('nats://127.0.0.1:4222'),

  // ClamAV (Virus Scanning)
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default('3310'),
  CLAMAV_TIMEOUT_MS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1000).max(60000))
    .default('10000'),

  // Gemini
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_REQUEST_TIMEOUT_MS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1_000).max(120_000))
    .default('60000'),

  // Internal API
  INTERNAL_API_SECRET: z.string().min(1, 'INTERNAL_API_SECRET is required'),

  // CORS
  FRONTEND_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Throws error with detailed messages if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);

    // Additional validation for production
    if (env.NODE_ENV === 'production') {
      if (!env.JWT_PUBLIC_KEY) {
        throw new Error('JWT_PUBLIC_KEY is required in production');
      }

      if (!env.FRONTEND_URL) {
        console.warn('⚠️  FRONTEND_URL is not set in production. CORS may not work correctly.');
      }

      if (env.INTERNAL_API_SECRET === 'dev-internal-secret') {
        throw new Error('INTERNAL_API_SECRET must be changed in production');
      }

      if (env.CV_SIGNING_SECRET === 'replace-this-secret') {
        throw new Error('CV_SIGNING_SECRET must be changed in production');
      }

      if (env.SMTP_SECURE === false) {
        console.warn('⚠️  SMTP_SECURE is false in production. Consider using TLS.');
      }
    }

    // Validate SMTP credentials if secure is enabled
    if (env.SMTP_SECURE && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.warn('⚠️  SMTP_SECURE is enabled but SMTP_USER or SMTP_PASS is not set.');
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Environment validation failed:\n');
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  ❌ ${path}: ${err.message}`);
      });
      console.error('\n💡 Check your .env file and compare with .env.example\n');
    } else if (error instanceof Error) {
      console.error(`\n❌ ${error.message}\n`);
    }
    process.exit(1);
  }
}

/**
 * Print validated environment summary (for debugging)
 */
export function printEnvSummary(env: Env): void {
  if (env.NODE_ENV === 'development') {
    console.log('\n📋 Environment Configuration:');
    console.log(`  Environment: ${env.NODE_ENV}`);
    console.log(`  Port: ${env.PORT}`);
    console.log(`  Database: ${env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'configured'}`);
    console.log(`  Redis: ${env.REDIS_URL.split('@')[1] || env.REDIS_URL}`);
    console.log(`  Event Bus: ${env.EVENT_BUS_URL}`);
    console.log(`  CV Storage: ${env.CV_STORAGE_DIR}`);
    console.log(`  JWT Public Key: ${env.JWT_PUBLIC_KEY ? '✅ Configured' : '⚠️  Using default (dev only)'}`);
    console.log(`  Frontend URL: ${env.FRONTEND_URL || 'http://localhost:5173 (default)'}\n`);
  }
}
