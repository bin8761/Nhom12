"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
exports.resetAppConfigCache = resetAppConfigCache;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DEFAULTS = Object.freeze({
    redisUrl: 'redis://127.0.0.1:6379',
    emailVerifyCodeTtlMinutes: 30,
    maxPendingAgeHours: 72,
    registerRatePerMinute: 10,
    loginRatePerMinute: 10,
    resendRatePerHour: 3,
    phoneOtpRatePerHour: 3,
    refreshRatePerMinute: 30,
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlDays: 30,
    notificationServiceUrl: 'http://localhost:4005',
    notificationServiceDefaultLocale: 'en',
    jwtIssuer: 'auth-service',
    jwtAudience: 'job-finder-clients',
    employerApprovalEnabled: true,
    employerApprovalDelaySeconds: 30,
    employerApprovalTrustedDomains: 'gmail.com,outlook.com,yahoo.com,hotmail.com',
    employerApprovalBlockedDomains: '10minutemail.com,tempmail.org,guerrillamail.com,mailinator.com',
    jobServiceUrl: 'http://localhost:4001',
    jobServiceSecret: 'dev-internal-secret',
    eventBusUrl: 'nats://127.0.0.1:4222',
});
let cachedConfig = null;
function readNumberEnv(key, fallback) {
    const raw = process.env[key];
    if (!raw) {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Environment variable ${key} must be a positive number, received "${raw}"`);
    }
    return parsed;
}
function readStringEnv(key, fallback) {
    const raw = process.env[key];
    if (!raw) {
        return fallback;
    }
    return raw;
}
function readOptionalStringEnv(key) {
    const raw = process.env[key];
    return raw && raw.length > 0 ? raw : undefined;
}
function loadAppConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    const redisUrl = readStringEnv('REDIS_URL', DEFAULTS.redisUrl);
    const emailVerifyCodeTtlMinutes = readNumberEnv('EMAIL_VERIFY_CODE_TTL_MIN', DEFAULTS.emailVerifyCodeTtlMinutes);
    const maxPendingAgeHours = readNumberEnv('AUTH_MAX_PENDING_AGE_HOURS', DEFAULTS.maxPendingAgeHours);
    const registerPerMinute = readNumberEnv('AUTH_RATE_LIMIT_REGISTER_PER_MIN', DEFAULTS.registerRatePerMinute);
    const loginPerMinute = readNumberEnv('AUTH_RATE_LIMIT_LOGIN_PER_MIN', DEFAULTS.loginRatePerMinute);
    const resendPerHour = readNumberEnv('AUTH_RATE_LIMIT_RESEND_PER_HOUR', DEFAULTS.resendRatePerHour);
    const phoneOtpPerHour = readNumberEnv('AUTH_RATE_LIMIT_PHONE_OTP_PER_HOUR', DEFAULTS.phoneOtpRatePerHour);
    const refreshPerMinute = readNumberEnv('AUTH_RATE_LIMIT_REFRESH_PER_MIN', DEFAULTS.refreshRatePerMinute);
    const accessTokenTtlSeconds = readNumberEnv('ACCESS_TOKEN_TTL_SECONDS', DEFAULTS.accessTokenTtlSeconds);
    const refreshTokenTtlDays = readNumberEnv('REFRESH_TOKEN_TTL_DAYS', DEFAULTS.refreshTokenTtlDays);
    const notificationServiceUrl = readStringEnv('NOTIFICATION_SERVICE_URL', DEFAULTS.notificationServiceUrl);
    const notificationDefaultLocale = readStringEnv('NOTIFICATION_SERVICE_DEFAULT_LOCALE', DEFAULTS.notificationServiceDefaultLocale);
    const employerApprovalEnabled = process.env.EMPLOYER_APPROVAL_ENABLED === 'true' || DEFAULTS.employerApprovalEnabled;
    const employerApprovalDelaySeconds = readNumberEnv('EMPLOYER_APPROVAL_DELAY_SECONDS', DEFAULTS.employerApprovalDelaySeconds);
    const trustedDomainsStr = readStringEnv('EMPLOYER_APPROVAL_TRUSTED_DOMAINS', DEFAULTS.employerApprovalTrustedDomains);
    const blockedDomainsStr = readStringEnv('EMPLOYER_APPROVAL_BLOCKED_DOMAINS', DEFAULTS.employerApprovalBlockedDomains);
    const jobServiceUrl = readStringEnv('JOB_SERVICE_URL', DEFAULTS.jobServiceUrl);
    const jobServiceSecret = readStringEnv('JOB_SERVICE_INTERNAL_SECRET', DEFAULTS.jobServiceSecret);
    const eventBusUrl = readStringEnv('EVENT_BUS_URL', DEFAULTS.eventBusUrl);
    cachedConfig = Object.freeze({
        environment: process.env.NODE_ENV ?? 'development',
        redis: { url: redisUrl },
        emailVerification: {
            codeTtlMinutes: emailVerifyCodeTtlMinutes,
            maxPendingAgeHours,
        },
        rateLimit: {
            registerPerMinute,
            loginPerMinute,
            resendPerHour,
            phoneOtpPerHour,
            refreshPerMinute,
        },
        authTokens: {
            accessTokenTtlSeconds,
            refreshTokenTtlDays,
        },
        notificationService: {
            baseUrl: notificationServiceUrl,
            defaultLocale: notificationDefaultLocale,
        },
        employerApproval: {
            autoApproveEnabled: employerApprovalEnabled,
            delaySeconds: employerApprovalDelaySeconds,
            trustedDomains: trustedDomainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0),
            blockedDomains: blockedDomainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0),
        },
        jwt: {
            privateKey: readOptionalStringEnv('JWT_PRIVATE_KEY'),
            publicKey: readOptionalStringEnv('JWT_PUBLIC_KEY'),
            issuer: readStringEnv('JWT_ISSUER', DEFAULTS.jwtIssuer),
            audience: readStringEnv('JWT_AUDIENCE', DEFAULTS.jwtAudience),
            algorithm: 'RS256',
        },
        jobService: {
            baseUrl: jobServiceUrl,
            internalSecret: jobServiceSecret,
        },
        eventBus: {
            url: eventBusUrl,
        },
    });
    return cachedConfig;
}
function resetAppConfigCache() {
    cachedConfig = null;
}
//# sourceMappingURL=appConfig.js.map