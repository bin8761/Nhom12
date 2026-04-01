export declare class ServiceError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: unknown;
    constructor({ message, code, statusCode, details }: {
        message: string;
        code: string;
        statusCode: number;
        details?: unknown;
    });
}
export declare class ConflictError extends ServiceError {
    constructor(message: string, details?: unknown);
}
export declare class InvalidCredentialsError extends ServiceError {
    constructor();
}
export declare class AccountSuspendedError extends ServiceError {
    constructor();
}
export declare class EmailNotVerifiedError extends ServiceError {
    constructor();
}
export declare class EmailAlreadyVerifiedError extends ServiceError {
    constructor();
}
export declare class RateLimitExceededError extends ServiceError {
    constructor(message?: string);
}
export declare class DeviceMismatchError extends ServiceError {
    constructor();
}
export declare class TokenRevokedError extends ServiceError {
    constructor(message?: string);
}
export declare class TokenExpiredError extends ServiceError {
    constructor(message?: string);
}
export declare class UnauthorizedError extends ServiceError {
    constructor(message?: string);
}
export declare class NotFoundError extends ServiceError {
    constructor(message?: string);
}
export declare class ForbiddenError extends ServiceError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class ValidationError extends ServiceError {
    constructor(message: string, details?: unknown);
}
export declare function isServiceError(error: unknown): error is ServiceError;
//# sourceMappingURL=errors.d.ts.map