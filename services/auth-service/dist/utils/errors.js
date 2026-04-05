"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ForbiddenError = exports.NotFoundError = exports.UnauthorizedError = exports.TokenExpiredError = exports.TokenRevokedError = exports.DeviceMismatchError = exports.RateLimitExceededError = exports.EmailAlreadyVerifiedError = exports.EmailNotVerifiedError = exports.AccountSuspendedError = exports.InvalidCredentialsError = exports.ConflictError = exports.ServiceError = void 0;
exports.isServiceError = isServiceError;
class ServiceError extends Error {
    constructor({ message, code, statusCode, details }) {
        super(message);
        this.name = new.target.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace?.(this, new.target);
    }
}
exports.ServiceError = ServiceError;
class ConflictError extends ServiceError {
    constructor(message, details) {
        super({ message, code: 'ERR_CONFLICT_EMAIL', statusCode: 409, details });
    }
}
exports.ConflictError = ConflictError;
class InvalidCredentialsError extends ServiceError {
    constructor() {
        super({ message: 'Email hoặc mật khẩu không đúng', code: 'ERR_INVALID_CREDENTIALS', statusCode: 401 });
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class AccountSuspendedError extends ServiceError {
    constructor() {
        super({ message: 'Tài khoản đã bị tạm khóa', code: 'ERR_ACCOUNT_SUSPENDED', statusCode: 423 });
    }
}
exports.AccountSuspendedError = AccountSuspendedError;
class EmailNotVerifiedError extends ServiceError {
    constructor() {
        super({ message: 'Email chưa được xác thực', code: 'ERR_EMAIL_NOT_VERIFIED', statusCode: 403 });
    }
}
exports.EmailNotVerifiedError = EmailNotVerifiedError;
class EmailAlreadyVerifiedError extends ServiceError {
    constructor() {
        super({ message: 'Email đã được xác thực rồi', code: 'ERR_EMAIL_ALREADY_VERIFIED', statusCode: 409 });
    }
}
exports.EmailAlreadyVerifiedError = EmailAlreadyVerifiedError;
class RateLimitExceededError extends ServiceError {
    constructor(message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.') {
        super({ message, code: 'ERR_RATE_LIMIT', statusCode: 429 });
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
class DeviceMismatchError extends ServiceError {
    constructor() {
        super({ message: 'Refresh token thuộc về thiết bị khác', code: 'ERR_DEVICE_MISMATCH', statusCode: 403 });
    }
}
exports.DeviceMismatchError = DeviceMismatchError;
class TokenRevokedError extends ServiceError {
    constructor(message = 'Refresh token đã bị thu hồi') {
        super({ message, code: 'ERR_TOKEN_REVOKED', statusCode: 403 });
    }
}
exports.TokenRevokedError = TokenRevokedError;
class TokenExpiredError extends ServiceError {
    constructor(message = 'Refresh token đã hết hạn') {
        super({ message, code: 'ERR_TOKEN_EXPIRED', statusCode: 401 });
    }
}
exports.TokenExpiredError = TokenExpiredError;
class UnauthorizedError extends ServiceError {
    constructor(message = 'Không có quyền truy cập') {
        super({ message, code: 'ERR_UNAUTHORIZED', statusCode: 401 });
    }
}
exports.UnauthorizedError = UnauthorizedError;
class NotFoundError extends ServiceError {
    constructor(message = 'Không tìm thấy tài nguyên') {
        super({ message, code: 'ERR_NOT_FOUND', statusCode: 404 });
    }
}
exports.NotFoundError = NotFoundError;
class ForbiddenError extends ServiceError {
    constructor(message = 'Bị cấm truy cập', code = 'ERR_FORBIDDEN', details) {
        super({ message, code, statusCode: 403, details });
    }
}
exports.ForbiddenError = ForbiddenError;
class ValidationError extends ServiceError {
    constructor(message, details) {
        super({ message, code: 'ERR_VALIDATION', statusCode: 400, details });
    }
}
exports.ValidationError = ValidationError;
function isServiceError(error) {
    return error instanceof ServiceError;
}
//# sourceMappingURL=errors.js.map