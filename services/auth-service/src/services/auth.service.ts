import { Prisma, UserRole, UserStatus, ApprovalStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { loadAppConfig } from '../config/appConfig';
import { generateAuthTokens, resolvePublicKey } from '../utils/tokenGenerator';
import {
  getEmailVerificationQueueContext,
  getPhoneVerificationQueueContext,
  getRedisConnection,
} from '../container/appContext';
import type { EmailVerificationJobPayload } from '../jobs/emailVerificationQueue';
import { publishAuthUserRegisteredEvent } from '../events/authEvents';
import logger from '../utils/logger';
import { syncCandidateToJobService } from './jobSync.service';
import { recordPhoneOtpFailed, recordPhoneOtpVerified } from '../metrics/phoneVerificationMetrics';
import {
  recordPasswordChange,
  recordPasswordResetRequest,
  recordPasswordResetResult,
} from '../metrics/passwordMetrics';
import {
  AccountSuspendedError,
  ConflictError,
  DeviceMismatchError,
  EmailNotVerifiedError,
  EmailAlreadyVerifiedError,
  InvalidCredentialsError,
  NotFoundError,
  RateLimitExceededError,
  TokenExpiredError,
  TokenRevokedError,
  UnauthorizedError,
} from '../utils/errors';
import type {
  AuthTokensResponse,
  LoginRequestInput,
  LogoutRequestInput,
  RefreshRequestInput,
  RegisterRequestInput,
  ResendVerificationRequestInput,
  ResendPhoneOtpRequestInput,
  ForgotPasswordRequestInput,
  ResetPasswordRequestInput,
  VerifyEmailRequestInput,
  VerifyPhoneRequestInput,
  MeResponse,
} from '../schemas/authSchemas';

export interface RegisterContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  locale?: string | null;
}

export interface LoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface RefreshContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface ResendVerificationContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  locale?: string | null;
  requestId?: string | null;
}
export interface LogoutContext {
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface VerifyPhoneContext {
  userId?: string | null;
  requestId?: string | null;
}

export interface ResendPhoneVerificationContext {
  userId?: string | null;
  requestId?: string | null;
}

export interface RequestPasswordResetContext {
  requestId?: string | null;
  locale?: string | null;
}

export interface ChangePasswordContext {
  userId?: string | null;
  requestId?: string | null;
}

export interface ResetPasswordContext {
  requestId?: string | null;
}

interface RegistrationResult {
  response: AuthTokensResponse;
  emailVerificationJob: EmailVerificationJobPayload;
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  deviceId: string;
  tokenUse: string;
  jti: string;
  email?: string;
}

type LoginResult = 'success' | 'failure';
type RefreshResult = 'success' | 'failure';
type ResendResult = 'success' | 'failure';
type LogoutResult = 'success' | 'failure';

const PHONE_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_TTL_MS = 1 * 60 * 1000;
const PASSWORD_RESET_RATE_LIMIT_MAX = 5;
const PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

type TokenRole = 'candidate' | 'employer' | 'admin';

function parseDateOfBirth(value: string): Date {
  const [dayStr, monthStr, yearStr] = value.split('/');
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  // Use UTC to avoid timezone issues
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatDateOfBirth(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

async function enforcePhoneOtpResendLimit(userId: string, limit: number): Promise<void> {
  if (limit <= 0) {
    return;
  }

  const redis = getRedisConnection();
  const redisKey = `rate:phone-otp:${userId}`;
  const currentCount = await redis.incr(redisKey);
  if (currentCount === 1) {
    await redis.expire(redisKey, 60 * 60);
  }

  if (currentCount > limit) {
    const ttl = await redis.ttl(redisKey);
    throw new RateLimitExceededError(
      ttl > 0
        ? `Đã vượt quá giới hạn gửi lại mã xác thực điện thoại. Vui lòng thử lại sau ${ttl} giây.`
        : 'Đã vượt quá giới hạn gửi lại mã xác thực điện thoại. Vui lòng thử lại sau.',
    );
  }
}

function mapUserRoleToTokenRole(role: UserRole): TokenRole {
  switch (role) {
    case UserRole.CANDIDATE:
      return 'candidate';
    case UserRole.EMPLOYER:
      return 'employer';
    case UserRole.ADMIN:
    default:
      return 'admin';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function logLoginAttempt({
  email,
  deviceId,
  result,
  reason,
  userId,
  requestId,
}: {
  email: string;
  deviceId: string;
  result: LoginResult;
  reason?: string;
  userId?: string;
  requestId?: string | null;
}) {
  logger.info({
    event: 'login',
    email,
    deviceId,
    result,
    reason,
    userId,
    requestId: requestId ?? undefined,
  });
}

function logRefreshAttempt({
  email,
  deviceId,
  result,
  reason,
  userId,
  requestId,
}: {
  email?: string;
  deviceId: string;
  result: RefreshResult;
  reason?: string;
  userId?: string;
  requestId?: string | null;
}) {
  logger.info({
    event: 'refresh',
    email,
    deviceId,
    result,
    reason,
    userId,
    requestId: requestId ?? undefined,
  });
}

function logResendAttempt({
  email,
  result,
  reason,
  requestId,
}: {
  email: string;
  result: ResendResult;
  reason?: string;
  requestId?: string | null;
}) {
  logger.info({
    event: 'resend_verification',
    email,
    result,
    reason,
    requestId: requestId ?? undefined,
  });
}

function logLogoutAttempt({
  deviceId,
  result,
  reason,
  userId,
  email,
  requestId,
}: {
  deviceId: string;
  result: LogoutResult;
  reason?: string;
  userId?: string;
  email?: string | null;
  requestId?: string | null;
}) {
  logger.info({
    event: 'logout',
    deviceId,
    result,
    reason,
    userId,
    email,
    requestId: requestId ?? undefined,
  });
}

function verifyRefreshToken(token: string): RefreshTokenPayload {
  const config = loadAppConfig();
  const publicKey = resolvePublicKey();
  if (!publicKey) {
    throw new TokenRevokedError('Khóa xác thực refresh token không khả dụng');
  }

  try {
    return jwt.verify(token, publicKey, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }

    throw new TokenRevokedError('Refresh token is invalid or malformed');
  }
}

export async function register(
  input: RegisterRequestInput,
  context: RegisterContext = {},
): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const config = loadAppConfig();

  const email = normalizeEmail(input.email);
  const deviceId = input.deviceId?.trim() || randomUUID();
  const ipAddress = context.ipAddress ?? null;
  const userAgent = context.userAgent ?? null;
  const locale = context.locale ?? undefined;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const verificationCode = String(randomInt(100000, 1000000)).padStart(6, '0');
  const verificationCodeHash = hashOtp(verificationCode);
  const verificationExpiresAt = new Date(Date.now() + config.emailVerification.codeTtlMinutes * 60 * 1000);
  const normalizedAddress = input.address.trim();
  const normalizedPhoneNumber = input.phoneNumber.trim();
  const parsedDateOfBirth = parseDateOfBirth(input.dateOfBirth);

  try {
    // If email already exists and pending, resend instead of conflict
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.emailVerified) {
        const now = new Date();
        const emailOtp = String(randomInt(100000, 1000000)).padStart(6, '0');
        const emailOtpHash = hashOtp(emailOtp);
        const emailOtpExpiresAt = new Date(now.getTime() + config.emailVerification.codeTtlMinutes * 60 * 1000);

        await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: input.fullName,
            dateOfBirth: parsedDateOfBirth,
            address: normalizedAddress,
            phoneNumber: normalizedPhoneNumber,
            phoneVerified: false,
            phoneVerifiedAt: null,
            approvalStatus:
              existing.role === UserRole.CANDIDATE ? ApprovalStatus.APPROVED : existing.approvalStatus,
          },
        });

        await prisma.emailVerification.upsert({
          where: { userId: existing.id },
          update: { codeHash: emailOtpHash, expiresAt: emailOtpExpiresAt, sentCount: { increment: 1 }, lastSentAt: now },
          create: { userId: existing.id, codeHash: emailOtpHash, expiresAt: emailOtpExpiresAt, sentCount: 1, lastSentAt: now },
        });

        const emailQueue = getEmailVerificationQueueContext();
        await emailQueue.add('send', { userId: existing.id, email: existing.email, verificationCode: emailOtp, locale });

        const tokens = generateAuthTokens({
          userId: existing.id,
          email: existing.email,
          role: mapUserRoleToTokenRole(existing.role),
          deviceId,
          emailVerified: existing.emailVerified,
          approvalStatus: existing.approvalStatus,
        });

        await prisma.refreshToken.upsert({
          where: { userId_deviceId: { userId: existing.id, deviceId } },
          update: {
            tokenHash: hashOtp(tokens.refreshToken),
            issuedAt: new Date(),
            expiresAt: tokens.refreshTokenExpiresAt,
            revokedAt: null,
            userAgent,
            ipAddress,
          },
          create: {
            userId: existing.id,
            deviceId,
            tokenHash: hashOtp(tokens.refreshToken),
            issuedAt: new Date(),
            expiresAt: tokens.refreshTokenExpiresAt,
            userAgent,
            ipAddress,
          },
        });

        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: 'Bearer',
          expiresIn: tokens.accessTokenExpiresIn,
          refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
          phoneVerificationRequired: true,
        } as AuthTokensResponse;
      }

      // Already verified ? conflict
      throw new ConflictError('Email đã được đăng ký');
    }

    const result = await prisma.$transaction<RegistrationResult>(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: input.role === 'candidate' ? UserRole.CANDIDATE : UserRole.EMPLOYER,
          status: UserStatus.PENDING,
          approvalStatus:
            input.role === 'candidate' ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
          emailVerified: false,
          fullName: input.fullName,
          dateOfBirth: parsedDateOfBirth,
          address: normalizedAddress,
          phoneNumber: normalizedPhoneNumber,
          phoneVerified: false,
          phoneVerifiedAt: null,
        },
      });

      const tokens = generateAuthTokens({
        userId: user.id,
        email: user.email,
        role: mapUserRoleToTokenRole(user.role),
        deviceId,
        emailVerified: user.emailVerified,
        approvalStatus: user.approvalStatus,
      });

      const refreshTokenHash = hashOtp(tokens.refreshToken);
      const issuedAt = new Date();

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          deviceId,
          tokenHash: refreshTokenHash,
          issuedAt,
          expiresAt: tokens.refreshTokenExpiresAt,
          userAgent,
          ipAddress,
        },
      });

      await tx.emailVerification.create({
        data: {
          userId: user.id,
          codeHash: verificationCodeHash,
          expiresAt: verificationExpiresAt,
          sentCount: 1,
          lastSentAt: new Date(),
        },
      });

      // Create initial profile based on role
      if (user.role === UserRole.CANDIDATE) {
        await tx.candidateProfile.create({
          data: {
            userId: user.id,
            fullName: input.fullName,
            phoneNumber: normalizedPhoneNumber,
            dateOfBirth: parsedDateOfBirth,
            location: normalizedAddress,
            updatedBy: user.id,
          },
        });
      } else if (user.role === UserRole.EMPLOYER) {
        await tx.employerProfile.create({
          data: {
            userId: user.id,
            companyName: (input as any).companyName || input.fullName,
            headquartersLocation: normalizedAddress,
            contactPhone: normalizedPhoneNumber,
            contactEmail: email,
            companyWebsite: (input as any).companyWebsite || null,
            updatedBy: user.id,
          },
        });
      }

      const response: AuthTokensResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresIn,
        refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
      };

      const emailVerificationJob: EmailVerificationJobPayload = {
        userId: user.id,
        email: user.email,
        verificationCode,
        locale,
      };

      return {
        response,
        emailVerificationJob,
      };
    });

    const emailQueue = getEmailVerificationQueueContext();
    await emailQueue.add('send', result.emailVerificationJob);

    await publishAuthUserRegisteredEvent({
      id: result.emailVerificationJob.userId,
      email,
      role: input.role,
      emittedAt: new Date().toISOString(),
    });

    logger.info({
      event: 'register',
      result: 'success',
      userId: result.emailVerificationJob.userId,
      email,
    });

    return {
      ...result.response,
      phoneVerificationRequired: true,
    };
  } catch (error) {
    logger.info({
      event: 'register',
      result: 'failure',
      email,
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Email đã được đăng ký');
    }

    throw error;
  }
}

export async function login(
  input: LoginRequestInput,
  context: LoginContext = {},
): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const deviceId = input.deviceId.trim();
  const ipAddress = context.ipAddress ?? null;
  const userAgent = context.userAgent ?? null;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    logLoginAttempt({ email, deviceId, result: 'failure', reason: 'user_not_found', requestId: context.requestId });
    throw new InvalidCredentialsError();
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    logLoginAttempt({ email, deviceId, result: 'failure', reason: 'invalid_password', userId: user.id, requestId: context.requestId });
    throw new InvalidCredentialsError();
  }

  if (user.status === UserStatus.SUSPENDED) {
    logLoginAttempt({ email, deviceId, result: 'failure', reason: 'account_suspended', userId: user.id, requestId: context.requestId });
    throw new AccountSuspendedError();
  }

  if (!user.emailVerified) {
    logLoginAttempt({ email, deviceId, result: 'failure', reason: 'email_not_verified', userId: user.id, requestId: context.requestId });
    throw new EmailNotVerifiedError();
  }

  const tokens = generateAuthTokens({
    userId: user.id,
    email: user.email,
    role: mapUserRoleToTokenRole(user.role),
    deviceId,
    emailVerified: user.emailVerified,
    approvalStatus: user.approvalStatus,
  });

  const refreshTokenHash = hashOtp(tokens.refreshToken);
  const issuedAt = new Date();

  await prisma.refreshToken.upsert({
    where: {
      userId_deviceId: {
        userId: user.id,
        deviceId,
      },
    },
    update: {
      tokenHash: refreshTokenHash,
      issuedAt,
      expiresAt: tokens.refreshTokenExpiresAt,
      revokedAt: null,
      userAgent,
      ipAddress,
    },
    create: {
      userId: user.id,
      deviceId,
      tokenHash: refreshTokenHash,
      issuedAt,
      expiresAt: tokens.refreshTokenExpiresAt,
      userAgent,
      ipAddress,
    },
  });

  logLoginAttempt({ email, deviceId, result: 'success', userId: user.id, requestId: context.requestId });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: 'Bearer',
    expiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
  };
}

export async function refresh(
  input: RefreshRequestInput,
  context: RefreshContext = {},
): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const payload = verifyRefreshToken(input.refreshToken);

  if (payload.tokenUse !== 'refresh') {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'wrong_token_use', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Token không phải là refresh token');
  }

  if (!payload.sub) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'missing_sub', email: payload.email, requestId: context.requestId });
    throw new TokenRevokedError('Refresh token thiếu thông tin subject');
  }

  if (!payload.deviceId) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'missing_device_id', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Refresh token thiếu thông tin device id');
  }

  if (payload.deviceId !== input.deviceId) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'device_mismatch', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new DeviceMismatchError();
  }

  const hashedIncomingToken = hashOtp(input.refreshToken);

  const refreshRecord = await prisma.refreshToken.findUnique({
    where: {
      userId_deviceId: {
        userId: payload.sub,
        deviceId: input.deviceId,
      },
    },
  });

  if (!refreshRecord) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'record_not_found', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Không tìm thấy bản ghi refresh token');
  }

  if (refreshRecord.revokedAt) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'token_revoked', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Refresh token đã bị thu hồi');
  }

  if (refreshRecord.expiresAt.getTime() <= Date.now()) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'token_expired', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenExpiredError();
  }

  if (refreshRecord.tokenHash !== hashedIncomingToken) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'hash_mismatch', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Refresh token đã được xoay vòng hoặc không hợp lệ');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'user_not_found', email: payload.email, userId: payload.sub, requestId: context.requestId });
    throw new TokenRevokedError('Tài khoản không còn tồn tại');
  }

  if (user.status === UserStatus.SUSPENDED) {
    logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'account_suspended', email: user.email, userId: user.id, requestId: context.requestId });
    throw new AccountSuspendedError();
  }

  const tokens = generateAuthTokens({
    userId: user.id,
    email: user.email,
    role: mapUserRoleToTokenRole(user.role),
    deviceId: input.deviceId,
    emailVerified: user.emailVerified,
    approvalStatus: user.approvalStatus,
  });

  const newRefreshHash = hashOtp(tokens.refreshToken);
  const issuedAt = new Date();

  await prisma.refreshToken.update({
    where: {
      userId_deviceId: {
        userId: user.id,
        deviceId: input.deviceId,
      },
    },
    data: {
      tokenHash: newRefreshHash,
      issuedAt,
      expiresAt: tokens.refreshTokenExpiresAt,
      revokedAt: null,
      userAgent: context.userAgent ?? refreshRecord.userAgent,
      ipAddress: context.ipAddress ?? refreshRecord.ipAddress,
    },
  });

  logRefreshAttempt({ deviceId: input.deviceId, result: 'success', email: user.email, userId: user.id, requestId: context.requestId });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: 'Bearer',
    expiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
  };
}

export async function resendVerification(
  input: ResendVerificationRequestInput,
  context: ResendVerificationContext = {},
): Promise<void> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const requestId = context.requestId ?? null;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    logResendAttempt({ email, result: 'failure', reason: 'user_not_found', requestId });
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    logResendAttempt({ email, result: 'failure', reason: 'already_verified', requestId });
    throw new EmailAlreadyVerifiedError();
  }

  const code = String(randomInt(100000, 1000000)).padStart(6, '0');
  const codeHash = hashOtp(code);
  const config = loadAppConfig();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.emailVerification.codeTtlMinutes * 60 * 1000);

  await prisma.emailVerification.upsert({
    where: { userId: user.id },
    update: {
      codeHash,
      expiresAt,
      sentCount: { increment: 1 },
      lastSentAt: now,
    },
    create: {
      userId: user.id,
      codeHash,
      expiresAt,
      sentCount: 1,
      lastSentAt: now,
    },
  });

  const queue = getEmailVerificationQueueContext();
  await queue.add('send', {
    userId: user.id,
    email: user.email,
    verificationCode: code,
    locale: context.locale ?? undefined,
  });

  logResendAttempt({ email, result: 'success', requestId });
}

export async function verifyEmail(input: VerifyEmailRequestInput): Promise<void> {
  const prisma = getPrismaClient();
  const config = loadAppConfig();
  const email = normalizeEmail(input.email);
  const code = input.code.trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    return; // idempotent
  }

  const record = await prisma.emailVerification.findUnique({ where: { userId: user.id } });
  if (!record) {
    throw new NotFoundError('Verification record not found');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new TokenExpiredError('Verification code expired');
  }

  const providedHash = hashOtp(code);
  if (providedHash !== record.codeHash) {
    throw new InvalidCredentialsError();
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifiedAt: new Date(), status: 'ACTIVE' },
    });

    await tx.emailVerification.delete({ where: { userId: user.id } });

    return updatedUser;
  });

  await syncCandidateToJobService(updatedUser);

  // If this is an employer and auto-approval is enabled, trigger approval process
  if (updatedUser.role === 'EMPLOYER' && config.employerApproval.autoApproveEnabled) {
    try {
      const { getEmployerApprovalQueue } = await import('../jobs/employerApprovalQueue');
      const approvalQueue = getEmployerApprovalQueue();
      
      await approvalQueue.add('process', {
        userId: updatedUser.id,
        email: updatedUser.email,
        role: 'employer',
        registrationData: {
          createdAt: updatedUser.createdAt,
        },
      }, {
        delay: config.employerApproval.delaySeconds * 1000, // Convert to milliseconds
      });

      logger.info({
        event: 'employer_approval_queued',
        userId: updatedUser.id,
        email: updatedUser.email,
        delaySeconds: config.employerApproval.delaySeconds,
      });
    } catch (error) {
      logger.error({
        event: 'employer_approval_queue_failed',
        userId: updatedUser.id,
        email: updatedUser.email,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw error - email verification should still succeed
    }
  }
}

export async function resendPhoneVerification(
  input: ResendPhoneOtpRequestInput,
  context: ResendPhoneVerificationContext = {},
): Promise<void> {
  if (!context.userId) {
    throw new UnauthorizedError('User context missing for phone verification resend');
  }

  const prisma = getPrismaClient();
  const requestId = context.requestId ?? null;
  const normalizedPhoneNumber = input.phoneNumber.trim();
  const config = loadAppConfig();

  const user = await prisma.user.findUnique({ where: { id: context.userId } });

  if (!user) {
    logger.warn({
      event: 'phone_verification_resend_failed',
      reason: 'user_not_found',
      userId: context.userId,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new NotFoundError('User not found');
  }

  const storedPhone = user.phoneNumber?.trim();
  if (!storedPhone) {
    logger.warn({
      event: 'phone_verification_resend_failed',
      reason: 'phone_missing',
      userId: user.id,
      requestId: requestId ?? undefined,
    });
    throw new NotFoundError('Phone number not set for user');
  }

  if (storedPhone !== normalizedPhoneNumber) {
    logger.warn({
      event: 'phone_verification_resend_failed',
      reason: 'phone_mismatch',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  if (user.phoneVerified) {
    logger.info({
      event: 'phone_verification_resend_skipped',
      reason: 'already_verified',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    return;
  }

  await enforcePhoneOtpResendLimit(user.id, config.rateLimit.phoneOtpPerHour);

  const now = new Date();
  const code = String(randomInt(100000, 1000000)).padStart(6, '0');
  const codeHash = hashOtp(code);
  const expiresAt = new Date(now.getTime() + PHONE_OTP_TTL_MS);

  await prisma.phoneVerification.upsert({
    where: {
      userId_phoneNumber: {
        userId: user.id,
        phoneNumber: normalizedPhoneNumber,
      },
    },
    update: {
      codeHash,
      expiresAt,
      lastSentAt: now,
      sentCount: { increment: 1 },
    },
    create: {
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      codeHash,
      expiresAt,
      sentCount: 1,
      lastSentAt: now,
    },
  });

  const queue = getPhoneVerificationQueueContext();
  await queue.add('send', {
    userId: user.id,
    phoneNumber: normalizedPhoneNumber,
    code,
    origin: 'resend',
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.info({
      event: 'phone_verification_code_debug',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      code,
      requestId: requestId ?? undefined,
    });
  }

  logger.info({
    event: 'phone_verification_resend_requested',
    userId: user.id,
    phoneNumber: normalizedPhoneNumber,
    requestId: requestId ?? undefined,
  });
}

export async function verifyPhone(
  input: VerifyPhoneRequestInput,
  context: VerifyPhoneContext = {},
): Promise<void> {
  if (!context.userId) {
    throw new UnauthorizedError('User context missing for phone verification');
  }

  const prisma = getPrismaClient();
  const requestId = context.requestId ?? null;
  const normalizedPhoneNumber = input.phoneNumber.trim();
  const code = input.code.trim();

  const user = await prisma.user.findUnique({ where: { id: context.userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const storedPhone = user.phoneNumber?.trim() ?? null;
  if (!storedPhone || storedPhone !== normalizedPhoneNumber) {
    recordPhoneOtpFailed('phone_mismatch');
    logger.warn({
      event: 'phone_verification_failed',
      reason: 'phone_mismatch',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  const verificationRecord = await prisma.phoneVerification.findUnique({
    where: {
      userId_phoneNumber: {
        userId: user.id,
        phoneNumber: normalizedPhoneNumber,
      },
    },
  });

  if (user.phoneVerified) {
    if (verificationRecord) {
      try {
        await prisma.phoneVerification.delete({ where: { id: verificationRecord.id } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
          throw error;
        }
      }
    }
    return;
  }

  if (!verificationRecord) {
    recordPhoneOtpFailed('record_not_found');
    logger.warn({
      event: 'phone_verification_failed',
      reason: 'record_not_found',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new NotFoundError('Phone verification record not found');
  }

  if (verificationRecord.expiresAt.getTime() <= Date.now()) {
    try {
      await prisma.phoneVerification.delete({ where: { id: verificationRecord.id } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
        throw error;
      }
    }

    recordPhoneOtpFailed('expired');
    logger.warn({
      event: 'phone_verification_failed',
      reason: 'expired',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new TokenExpiredError('Verification code expired');
  }

  const providedHash = hashOtp(code);
  if (providedHash !== verificationRecord.codeHash) {
    recordPhoneOtpFailed('invalid_code');
    logger.warn({
      event: 'phone_verification_failed',
      reason: 'invalid_code',
      userId: user.id,
      phoneNumber: normalizedPhoneNumber,
      requestId: requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: now,
        phoneNumber: normalizedPhoneNumber,
      },
    });

    await tx.phoneVerification.delete({
      where: { id: verificationRecord.id },
    });
  });

  logger.info({
    event: 'phone_verification_verified',
    userId: user.id,
    phoneNumber: normalizedPhoneNumber,
    requestId: requestId ?? undefined,
  });

  recordPhoneOtpVerified('other');
}

export async function getCurrentUserProfile(userId: string): Promise<MeResponse> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.fullName || !user.address || !user.phoneNumber || !user.dateOfBirth) {
    throw new NotFoundError('User profile not found');
  }

  return {
    id: user.id,
    email: user.email,
    role: mapUserRoleToTokenRole(user.role),
    emailVerified: user.emailVerified,
    fullName: user.fullName,
    dateOfBirth: formatDateOfBirth(user.dateOfBirth),
    address: user.address,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
  };
}

export async function changePassword(
  context: ChangePasswordContext,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!context.userId) {
    throw new UnauthorizedError('User context missing for password change');
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: context.userId } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    recordPasswordChange('failure');
    logger.warn({
      event: 'password_change_failed',
      reason: 'invalid_current_password',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  if (currentPassword === newPassword) {
    recordPasswordChange('failure');
    logger.warn({
      event: 'password_change_failed',
      reason: 'password_unchanged',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new ConflictError('New password must be different from current password');
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      updatedAt: new Date(),
    },
  });

  recordPasswordChange('success');

  logger.info({
    event: 'password_change_success',
    userId: user.id,
    requestId: context.requestId ?? undefined,
  });
}

async function enforcePasswordResetRateLimit(email: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `rate:password-reset:${email}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS);
  }

  if (count > PASSWORD_RESET_RATE_LIMIT_MAX) {
    const ttl = await redis.ttl(key);
    recordPasswordResetRequest('rate_limited');
    logger.warn({
      event: 'password_reset_request_rate_limited',
      email,
      ttlSeconds: ttl > 0 ? ttl : undefined,
    });
    throw new RateLimitExceededError(
      ttl > 0
        ? `Too many password reset requests. Please try again in ${ttl} seconds.`
        : 'Too many password reset requests. Please try again later.',
    );
  }
}

export async function requestPasswordReset(
  input: ForgotPasswordRequestInput,
  context: RequestPasswordResetContext = {},
): Promise<void> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);

  await enforcePasswordResetRateLimit(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordPasswordResetRequest('ignored');
    logger.info({
      event: 'password_reset_requested',
      result: 'ignored',
      reason: 'user_not_found',
      email,
      requestId: context.requestId ?? undefined,
    });
    return;
  }

  const now = new Date();
  const code = String(randomInt(100000, 1000000)).padStart(6, '0');
  const codeHash = hashOtp(code);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_OTP_TTL_MS);

  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    update: {
      codeHash,
      expiresAt,
      consumedAt: null,
      sentCount: { increment: 1 },
      lastSentAt: now,
      failedAttempts: 0,
    },
    create: {
      userId: user.id,
      codeHash,
      expiresAt,
      consumedAt: null,
      sentCount: 1,
      lastSentAt: now,
      failedAttempts: 0,
    },
  });

  const emailQueue = getEmailVerificationQueueContext();
  await emailQueue.add('password-reset', {
    userId: user.id,
    email: user.email,
    verificationCode: code,
    locale: context.locale ?? undefined,
  });

  recordPasswordResetRequest('sent');
  logger.info({
    event: 'password_reset_requested',
    result: 'sent',
    userId: user.id,
    email: user.email,
    requestId: context.requestId ?? undefined,
  });
}

export async function resetPassword(
  input: ResetPasswordRequestInput,
  context: ResetPasswordContext = {},
): Promise<void> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'user_not_found',
      email,
      requestId: context.requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  const token = await prisma.passwordResetToken.findUnique({ where: { userId: user.id } });
  if (!token) {
    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'token_not_found',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new InvalidCredentialsError();
  }

  if (token.failedAttempts >= 5) {
    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'locked_out',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new RateLimitExceededError('Quá nhiều lần thử sai. Vui lòng yêu cầu mã OTP mới.');
  }

  if (token.consumedAt) {
    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'token_consumed',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new TokenExpiredError('Reset code already used');
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'expired',
      userId: user.id,
      requestId: context.requestId ?? undefined,
    });
    throw new TokenExpiredError('Reset code expired');
  }

  const providedHash = hashOtp(input.code);
  if (providedHash !== token.codeHash) {
    const updatedToken = await prisma.passwordResetToken.update({
      where: { userId: user.id },
      data: {
        failedAttempts: { increment: 1 },
        lastSentAt: token.lastSentAt,
      },
    });

    recordPasswordResetResult('failure');
    logger.warn({
      event: 'password_reset_failed',
      reason: 'invalid_code',
      userId: user.id,
      requestId: context.requestId ?? undefined,
      failedAttempts: updatedToken.failedAttempts,
    });

    if (updatedToken.failedAttempts >= 5) {
      throw new RateLimitExceededError('Quá nhiều lần thử sai. Vui lòng yêu cầu mã OTP mới.');
    }

    throw new InvalidCredentialsError();
  }

  const newHash = await bcrypt.hash(input.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        updatedAt: new Date(),
      },
    });

    await tx.passwordResetToken.update({
      where: { userId: user.id },
      data: {
        consumedAt: new Date(),
        failedAttempts: 0,
      },
    });
  });

  recordPasswordResetResult('success');

  logger.info({
    event: 'password_reset_success',
    userId: user.id,
    requestId: context.requestId ?? undefined,
  });
}
export async function logout(
  input: LogoutRequestInput,
  context: LogoutContext = {},
): Promise<void> {
  if (!context.userId) {
    throw new UnauthorizedError('User context missing for logout');
  }

  const prisma = getPrismaClient();

  const refreshRecord = await prisma.refreshToken.findUnique({
    where: {
      userId_deviceId: {
        userId: context.userId,
        deviceId: input.deviceId.trim(),
      },
    },
  });

  if (!refreshRecord) {
    logLogoutAttempt({
      deviceId: input.deviceId,
      result: 'failure',
      reason: 'record_not_found',
      userId: context.userId,
      email: context.userEmail,
      requestId: context.requestId,
    });
    throw new NotFoundError('Active refresh token for this device was not found');
  }

  if (refreshRecord.revokedAt) {
    logLogoutAttempt({
      deviceId: input.deviceId,
      result: 'success',
      reason: 'already_revoked',
      userId: context.userId,
      email: context.userEmail,
      requestId: context.requestId,
    });
    return;
  }

  await prisma.refreshToken.update({
    where: { id: refreshRecord.id },
    data: {
      revokedAt: new Date(),
      userAgent: context.userAgent ?? refreshRecord.userAgent,
      ipAddress: context.ipAddress ?? refreshRecord.ipAddress,
    },
  });

  logLogoutAttempt({
    deviceId: input.deviceId,
    result: 'success',
    userId: context.userId,
    email: context.userEmail,
    requestId: context.requestId,
  });
}



















