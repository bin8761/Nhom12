import type { Request, RequestHandler } from 'express';
export interface RateLimitOptions {
    /** Key that differentiates callers (e.g., IP, email). Return null to skip limiting. */
    keyResolver: (req: Request) => string | null;
    /** Maximum number of requests allowed inside the window. */
    limit: number;
    /** Window length in seconds. */
    windowSeconds: number;
    /** Identifier to include in Redis key namespace. */
    namespace: string;
}
export declare function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler;
export declare const registerRateLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const loginRateLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const resendVerificationRateLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const resendPhoneOtpRateLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const passwordResetRateLimiter: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=rateLimit.d.ts.map