import { z } from 'zod';
/**
 * Environment variables schema for Auth Service
 * This validates all required and optional environment variables at startup
 */
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "staging", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    DATABASE_URL: z.ZodEffects<z.ZodString, string, string>;
    REDIS_URL: z.ZodEffects<z.ZodString, string, string>;
    JWT_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
    JWT_PUBLIC_KEY: z.ZodOptional<z.ZodString>;
    JWT_ISSUER: z.ZodDefault<z.ZodString>;
    JWT_AUDIENCE: z.ZodDefault<z.ZodString>;
    ACCESS_TOKEN_TTL_SECONDS: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    REFRESH_TOKEN_TTL_DAYS: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    EMAIL_VERIFY_CODE_TTL_MIN: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    AUTH_RATE_LIMIT_REGISTER_PER_MIN: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    AUTH_RATE_LIMIT_LOGIN_PER_MIN: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    AUTH_RATE_LIMIT_RESEND_PER_HOUR: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    AUTH_RATE_LIMIT_PHONE_OTP_PER_HOUR: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    AUTH_RATE_LIMIT_REFRESH_PER_MIN: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    NOTIFICATION_SERVICE_URL: z.ZodDefault<z.ZodString>;
    NOTIFICATION_SERVICE_DEFAULT_LOCALE: z.ZodDefault<z.ZodString>;
    JOB_SERVICE_URL: z.ZodDefault<z.ZodString>;
    JOB_SERVICE_INTERNAL_SECRET: z.ZodString;
    EVENT_BUS_URL: z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>;
    EMPLOYER_APPROVAL_ENABLED: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
    EMPLOYER_APPROVAL_DELAY_SECONDS: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    EMPLOYER_APPROVAL_TRUSTED_DOMAINS: z.ZodDefault<z.ZodString>;
    EMPLOYER_APPROVAL_BLOCKED_DOMAINS: z.ZodDefault<z.ZodString>;
    FRONTEND_URL: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV?: "development" | "staging" | "production" | "test";
    PORT?: number;
    DATABASE_URL?: string;
    REDIS_URL?: string;
    JWT_PRIVATE_KEY?: string;
    JWT_PUBLIC_KEY?: string;
    JWT_ISSUER?: string;
    JWT_AUDIENCE?: string;
    ACCESS_TOKEN_TTL_SECONDS?: number;
    REFRESH_TOKEN_TTL_DAYS?: number;
    EMAIL_VERIFY_CODE_TTL_MIN?: number;
    AUTH_RATE_LIMIT_REGISTER_PER_MIN?: number;
    AUTH_RATE_LIMIT_LOGIN_PER_MIN?: number;
    AUTH_RATE_LIMIT_RESEND_PER_HOUR?: number;
    AUTH_RATE_LIMIT_PHONE_OTP_PER_HOUR?: number;
    AUTH_RATE_LIMIT_REFRESH_PER_MIN?: number;
    NOTIFICATION_SERVICE_URL?: string;
    NOTIFICATION_SERVICE_DEFAULT_LOCALE?: string;
    JOB_SERVICE_URL?: string;
    JOB_SERVICE_INTERNAL_SECRET?: string;
    EVENT_BUS_URL?: string;
    EMPLOYER_APPROVAL_ENABLED?: boolean;
    EMPLOYER_APPROVAL_DELAY_SECONDS?: number;
    EMPLOYER_APPROVAL_TRUSTED_DOMAINS?: string;
    EMPLOYER_APPROVAL_BLOCKED_DOMAINS?: string;
    FRONTEND_URL?: string;
}, {
    NODE_ENV?: "development" | "staging" | "production" | "test";
    PORT?: string;
    DATABASE_URL?: string;
    REDIS_URL?: string;
    JWT_PRIVATE_KEY?: string;
    JWT_PUBLIC_KEY?: string;
    JWT_ISSUER?: string;
    JWT_AUDIENCE?: string;
    ACCESS_TOKEN_TTL_SECONDS?: string;
    REFRESH_TOKEN_TTL_DAYS?: string;
    EMAIL_VERIFY_CODE_TTL_MIN?: string;
    AUTH_RATE_LIMIT_REGISTER_PER_MIN?: string;
    AUTH_RATE_LIMIT_LOGIN_PER_MIN?: string;
    AUTH_RATE_LIMIT_RESEND_PER_HOUR?: string;
    AUTH_RATE_LIMIT_PHONE_OTP_PER_HOUR?: string;
    AUTH_RATE_LIMIT_REFRESH_PER_MIN?: string;
    NOTIFICATION_SERVICE_URL?: string;
    NOTIFICATION_SERVICE_DEFAULT_LOCALE?: string;
    JOB_SERVICE_URL?: string;
    JOB_SERVICE_INTERNAL_SECRET?: string;
    EVENT_BUS_URL?: string;
    EMPLOYER_APPROVAL_ENABLED?: string;
    EMPLOYER_APPROVAL_DELAY_SECONDS?: string;
    EMPLOYER_APPROVAL_TRUSTED_DOMAINS?: string;
    EMPLOYER_APPROVAL_BLOCKED_DOMAINS?: string;
    FRONTEND_URL?: string;
}>;
export type Env = z.infer<typeof envSchema>;
/**
 * Validate environment variables at startup
 * Throws error with detailed messages if validation fails
 */
export declare function validateEnv(): Env;
/**
 * Print validated environment summary (for debugging)
 */
export declare function printEnvSummary(env: Env): void;
export {};
//# sourceMappingURL=envValidation.d.ts.map