export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor({ message, code, statusCode, details }: { message: string; code: string; statusCode: number; details?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: unknown) {
    super({ message, code: 'ERR_CONFLICT_EMAIL', statusCode: 409, details });
  }
}

export class InvalidCredentialsError extends ServiceError {
  constructor() {
    super({ message: 'Invalid email or password', code: 'ERR_INVALID_CREDENTIALS', statusCode: 401 });
  }
}

export class AccountSuspendedError extends ServiceError {
  constructor() {
    super({ message: 'Account is suspended', code: 'ERR_ACCOUNT_SUSPENDED', statusCode: 423 });
  }
}

export class EmailNotVerifiedError extends ServiceError {
  constructor() {
    super({ message: 'Email is not verified', code: 'ERR_EMAIL_NOT_VERIFIED', statusCode: 403 });
  }
}

export class EmailAlreadyVerifiedError extends ServiceError {
  constructor() {
    super({ message: 'Email is already verified', code: 'ERR_EMAIL_ALREADY_VERIFIED', statusCode: 409 });
  }
}

export class RateLimitExceededError extends ServiceError {
  constructor(message = 'Too many requests. Please try again later.') {
    super({ message, code: 'ERR_RATE_LIMIT', statusCode: 429 });
  }
}

export class DeviceMismatchError extends ServiceError {
  constructor() {
    super({ message: 'Refresh token belongs to a different device', code: 'ERR_DEVICE_MISMATCH', statusCode: 403 });
  }
}

export class TokenRevokedError extends ServiceError {
  constructor(message = 'Refresh token has been revoked') {
    super({ message, code: 'ERR_TOKEN_REVOKED', statusCode: 403 });
  }
}

export class TokenExpiredError extends ServiceError {
  constructor(message = 'Refresh token has expired') {
    super({ message, code: 'ERR_TOKEN_EXPIRED', statusCode: 401 });
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = 'Unauthorized') {
    super({ message, code: 'ERR_UNAUTHORIZED', statusCode: 401 });
  }
}

export class NotFoundError extends ServiceError {
  constructor(message = 'Resource not found') {
    super({ message, code: 'ERR_NOT_FOUND', statusCode: 404 });
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = 'Forbidden', code = 'ERR_FORBIDDEN', details?: unknown) {
    super({ message, code, statusCode: 403, details });
  }
}

export class ValidationError extends ServiceError {
  constructor(message = 'Dữ liệu không hợp lệ', details?: unknown) {
    super({ message, code: 'ERR_VALIDATION', statusCode: 400, details });
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
