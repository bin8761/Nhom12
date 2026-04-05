"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
exports.printEnvSummary = printEnvSummary;
const zod_1 = require("zod");
/**
 * Environment variables schema for Auth Service
 * This validates all required and optional environment variables at startup
 */
const envSchema = zod_1.z.object({
    // Server
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().min(1).max(65535)).default('4001'),
    // Database
    DATABASE_URL: zod_1.z.string()
        .min(1, 'DATABASE_URL is required')
        .refine((url) => url.startsWith('mysql://') || url.startsWith('postgresql://'), 'DATABASE_URL must be a valid MySQL or PostgreSQL connection string'),
    // Redis
    REDIS_URL: zod_1.z.string()
        .min(1, 'REDIS_URL is required')
        .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), 'REDIS_URL must start with redis:// or rediss://'),
    // JWT Keys (Required in production)
    JWT_PRIVATE_KEY: zod_1.z.string().optional(),
    JWT_PUBLIC_KEY: zod_1.z.string().optional(),
    JWT_ISSUER: zod_1.z.string().default('auth-service'),
    JWT_AUDIENCE: zod_1.z.string().default('job-finder-clients'),
    // Token TTLs
    ACCESS_TOKEN_TTL_SECONDS: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(60).max(3600))
        .default('900'),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(90))
        .default('30'),
    // Email Verification
    EMAIL_VERIFY_CODE_TTL_MIN: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(5).max(120))
        .default('30'),
    // Rate Limiting
    AUTH_RATE_LIMIT_REGISTER_PER_MIN: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(1000))
        .default('10'),
    AUTH_RATE_LIMIT_LOGIN_PER_MIN: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(1000))
        .default('10'),
    AUTH_RATE_LIMIT_RESEND_PER_HOUR: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(100))
        .default('3'),
    AUTH_RATE_LIMIT_PHONE_OTP_PER_HOUR: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(100))
        .default('3'),
    AUTH_RATE_LIMIT_REFRESH_PER_MIN: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(1000))
        .default('30'),
    // External Services
    NOTIFICATION_SERVICE_URL: zod_1.z.string().url().default('http://localhost:4005'),
    NOTIFICATION_SERVICE_DEFAULT_LOCALE: zod_1.z.string().default('en'),
    JOB_SERVICE_URL: zod_1.z.string().url().default('http://localhost:4001'),
    JOB_SERVICE_INTERNAL_SECRET: zod_1.z.string().min(1, 'JOB_SERVICE_INTERNAL_SECRET is required'),
    // Event Bus
    EVENT_BUS_URL: zod_1.z.string()
        .refine((url) => url.startsWith('nats://'), 'EVENT_BUS_URL must start with nats://')
        .default('nats://127.0.0.1:4222'),
    // Employer Approval
    EMPLOYER_APPROVAL_ENABLED: zod_1.z.string()
        .transform((val) => val === 'true')
        .default('true'),
    EMPLOYER_APPROVAL_DELAY_SECONDS: zod_1.z.string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(0).max(3600))
        .default('30'),
    EMPLOYER_APPROVAL_TRUSTED_DOMAINS: zod_1.z.string().default('gmail.com,outlook.com,yahoo.com,hotmail.com'),
    EMPLOYER_APPROVAL_BLOCKED_DOMAINS: zod_1.z.string().default('10minutemail.com,tempmail.org,guerrillamail.com,mailinator.com'),
    // CORS
    FRONTEND_URL: zod_1.z.string().url().optional(),
});
/**
 * Validate environment variables at startup
 * Throws error with detailed messages if validation fails
 */
function validateEnv() {
    try {
        const env = envSchema.parse(process.env);
        // Additional validation for production
        if (env.NODE_ENV === 'production') {
            if (!env.JWT_PRIVATE_KEY || !env.JWT_PUBLIC_KEY) {
                throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production');
            }
            if (!env.FRONTEND_URL) {
                console.warn('⚠️  FRONTEND_URL is not set in production. CORS may not work correctly.');
            }
            if (env.JOB_SERVICE_INTERNAL_SECRET === 'dev-internal-secret') {
                throw new Error('JOB_SERVICE_INTERNAL_SECRET must be changed in production');
            }
        }
        return env;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('\n❌ Environment validation failed:\n');
            error.errors.forEach((err) => {
                const path = err.path.join('.');
                console.error(`  ❌ ${path}: ${err.message}`);
            });
            console.error('\n💡 Check your .env file and compare with .env.example\n');
        }
        else if (error instanceof Error) {
            console.error(`\n❌ ${error.message}\n`);
        }
        process.exit(1);
    }
}
/**
 * Print validated environment summary (for debugging)
 */
function printEnvSummary(env) {
    if (env.NODE_ENV === 'development') {
        console.log('\n📋 Environment Configuration:');
        console.log(`  Environment: ${env.NODE_ENV}`);
        console.log(`  Port: ${env.PORT}`);
        console.log(`  Database: ${env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'configured'}`);
        console.log(`  Redis: ${env.REDIS_URL.split('@')[1] || env.REDIS_URL}`);
        console.log(`  Event Bus: ${env.EVENT_BUS_URL}`);
        console.log(`  JWT Keys: ${env.JWT_PRIVATE_KEY ? '✅ Configured' : '⚠️  Using default (dev only)'}`);
        console.log(`  Frontend URL: ${env.FRONTEND_URL || 'http://localhost:5173 (default)'}\n`);
    }
}
//# sourceMappingURL=envValidation.js.map