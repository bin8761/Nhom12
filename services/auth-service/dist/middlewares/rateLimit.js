"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetRateLimiter = exports.resendPhoneOtpRateLimiter = exports.resendVerificationRateLimiter = exports.loginRateLimiter = exports.registerRateLimiter = void 0;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
const appContext_1 = require("../container/appContext");
const appConfig_1 = require("../config/appConfig");
const RATE_LIMIT_ERROR_BODY = {
    code: 'ERR_RATE_LIMIT',
    message: 'Too many requests. Please try again later.',
};
function createRateLimitMiddleware(options) {
    return async (req, res, next) => {
        try {
            const keySuffix = options.keyResolver(req);
            if (!keySuffix) {
                return next();
            }
            const redis = (0, appContext_1.getRedisConnection)();
            const redisKey = `rate:${options.namespace}:${keySuffix}`;
            const currentCount = await redis.incr(redisKey);
            if (currentCount === 1) {
                await redis.expire(redisKey, options.windowSeconds);
            }
            if (currentCount > options.limit) {
                const retryAfter = await redis.ttl(redisKey);
                if (retryAfter > 0) {
                    res.setHeader('Retry-After', retryAfter);
                }
                return res.status(429).json(RATE_LIMIT_ERROR_BODY);
            }
            return next();
        }
        catch (error) {
            return next(error);
        }
    };
}
const config = (0, appConfig_1.loadAppConfig)();
exports.registerRateLimiter = createRateLimitMiddleware({
    keyResolver: (req) => req.ip,
    limit: config.rateLimit.registerPerMinute,
    windowSeconds: 60,
    namespace: 'auth-register-ip',
});
exports.loginRateLimiter = createRateLimitMiddleware({
    keyResolver: (req) => req.ip,
    limit: config.rateLimit.loginPerMinute,
    windowSeconds: 60,
    namespace: 'auth-login-ip',
});
exports.resendVerificationRateLimiter = createRateLimitMiddleware({
    keyResolver: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
        return email && email.length > 0 ? email : null;
    },
    limit: config.rateLimit.resendPerHour,
    windowSeconds: 60 * 60,
    namespace: 'auth-resend-email',
});
exports.resendPhoneOtpRateLimiter = createRateLimitMiddleware({
    keyResolver: (req) => {
        const userId = typeof req.user?.id === 'string' ? req.user.id : null;
        return userId && userId.length > 0 ? userId : null;
    },
    limit: config.rateLimit.phoneOtpPerHour,
    windowSeconds: 60 * 60,
    namespace: 'auth-resend-phone',
});
exports.passwordResetRateLimiter = createRateLimitMiddleware({
    keyResolver: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
        return email && email.length > 0 ? email : null;
    },
    limit: 5,
    windowSeconds: 10 * 60,
    namespace: 'auth-password-reset',
});
//# sourceMappingURL=rateLimit.js.map