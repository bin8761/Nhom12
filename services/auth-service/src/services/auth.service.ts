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
} from '../container/appContext';
import { publishAuthUserRegisteredEvent } from '../events/authEvents';
import logger from '../utils/logger';
import {
  ConflictError,
  EmailAlreadyVerifiedError,
  NotFoundError,
  InvalidCredentialsError,
  TokenExpiredError,
  AccountSuspendedError,
  EmailNotVerifiedError,
  TokenRevokedError,
  DeviceMismatchError,
  UnauthorizedError,
} from '../utils/errors';
import type {
  AuthTokensResponse,
  RegisterRequestInput,
  ResendVerificationRequestInput,
  ResendPhoneOtpRequestInput,
  VerifyEmailRequestInput,
  VerifyPhoneRequestInput,
  LoginRequestInput,
  LogoutRequestInput,
  RefreshRequestInput,
  ForgotPasswordRequestInput,
  ResetPasswordRequestInput,
  MeResponse,
} from '../schemas/authSchemas';

// === REGISTRATION FLOW (Same as develop) ===

function parseDateOfBirth(value: string): Date {
  const [dayStr, monthStr, yearStr] = value.split('/');
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 0, 0, 0, 0));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mapUserRoleToTokenRole(role: UserRole): 'candidate' | 'employer' | 'admin' {
  switch (role) {
    case UserRole.CANDIDATE: return 'candidate';
    case UserRole.EMPLOYER: return 'employer';
    case UserRole.ADMIN: return 'admin';
    default: return 'admin';
  }
}

export async function register(
  input: RegisterRequestInput,
  context: { ipAddress?: string | null; userAgent?: string | null; locale?: string | null } = {},
): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const config = loadAppConfig();

  const email = normalizeEmail(input.email);
  const deviceId = input.deviceId?.trim() || randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const verificationCode = String(randomInt(100000, 1000000)).padStart(6, '0');
  const verificationCodeHash = hashOtp(verificationCode);
  const verificationExpiresAt = new Date(Date.now() + config.emailVerification.codeTtlMinutes * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: input.role === 'candidate' ? UserRole.CANDIDATE : UserRole.EMPLOYER,
      status: UserStatus.PENDING,
      approvalStatus: input.role === 'candidate' ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
      fullName: input.fullName,
      dateOfBirth: parseDateOfBirth(input.dateOfBirth),
      address: input.address.trim(),
      phoneNumber: input.phoneNumber.trim(),
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

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      deviceId,
      tokenHash: hashOtp(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  });

  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      codeHash: verificationCodeHash,
      expiresAt: verificationExpiresAt,
    },
  });

  if (user.role === UserRole.CANDIDATE) {
    await prisma.candidateProfile.create({
      data: {
        userId: user.id,
        fullName: input.fullName,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        location: user.address,
        updatedBy: user.id,
      },
    });
  } else {
    await prisma.employerProfile.create({
      data: {
        userId: user.id,
        companyName: input.fullName,
        headquartersLocation: user.address,
        contactPhone: user.phoneNumber,
        contactEmail: email,
        updatedBy: user.id,
      },
    });
  }

  const emailQueue = getEmailVerificationQueueContext();
  await emailQueue.add('send', { userId: user.id, email: user.email, verificationCode, locale: context.locale });

  await publishAuthUserRegisteredEvent({
    id: user.id,
    email,
    role: input.role,
    emittedAt: new Date().toISOString(),
  });

  return { ...tokens, tokenType: 'Bearer', phoneVerificationRequired: true };
}

export async function resendVerification(
  input: ResendVerificationRequestInput,
  context: { locale?: string | null; requestId?: string | null } = {},
): Promise<void> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return;
  const code = String(randomInt(100000, 1000000)).padStart(6, '0');
  const config = loadAppConfig();
  await prisma.emailVerification.upsert({
    where: { userId: user.id },
    update: { codeHash: hashOtp(code), expiresAt: new Date(Date.now() + config.emailVerification.codeTtlMinutes * 60 * 1000) },
    create: { userId: user.id, codeHash: hashOtp(code), expiresAt: new Date(Date.now() + config.emailVerification.codeTtlMinutes * 60 * 1000) },
  });
  const queue = getEmailVerificationQueueContext();
  await queue.add('send', { userId: user.id, email: user.email, verificationCode: code, locale: context.locale });
}

export async function verifyEmail(input: VerifyEmailRequestInput): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  if (!user || user.emailVerified) return;
  const record = await prisma.emailVerification.findUnique({ where: { userId: user.id } });
  if (!record || record.expiresAt.getTime() <= Date.now() || hashOtp(input.code) !== record.codeHash) {
    throw new InvalidCredentialsError();
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verifiedAt: new Date(), status: 'ACTIVE' } }),
    prisma.emailVerification.delete({ where: { userId: user.id } }),
  ]);
}

// === LOGIN / AUTH FLOW (New Feature) ===

function verifyRefreshToken(token: string): any {
  const config = loadAppConfig();
  const publicKey = resolvePublicKey();
  if (!publicKey) throw new TokenRevokedError('Key unavailable');
  try {
    return jwt.verify(token, publicKey, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as any;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new TokenExpiredError();
    throw new TokenRevokedError('Token invalid');
  }
}

export async function login(input: LoginRequestInput, context: { ipAddress?: string | null; userAgent?: string | null } = {}): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }

  if (user.status === UserStatus.SUSPENDED) throw new AccountSuspendedError();
  if (!user.emailVerified) throw new EmailNotVerifiedError();

  const tokens = generateAuthTokens({
    userId: user.id,
    email: user.email,
    role: mapUserRoleToTokenRole(user.role),
    deviceId: input.deviceId,
    emailVerified: user.emailVerified,
    approvalStatus: user.approvalStatus,
  });

  await prisma.refreshToken.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId: input.deviceId } },
    update: { tokenHash: hashOtp(tokens.refreshToken), expiresAt: tokens.refreshTokenExpiresAt, ipAddress: context.ipAddress, userAgent: context.userAgent, revokedAt: null },
    create: { userId: user.id, deviceId: input.deviceId, tokenHash: hashOtp(tokens.refreshToken), expiresAt: tokens.refreshTokenExpiresAt, ipAddress: context.ipAddress, userAgent: context.userAgent },
  });

  return { ...tokens, tokenType: 'Bearer' };
}

export async function refresh(input: RefreshRequestInput, context: { ipAddress?: string | null; userAgent?: string | null } = {}): Promise<AuthTokensResponse> {
  const prisma = getPrismaClient();
  const payload = verifyRefreshToken(input.refreshToken);
  if (payload.deviceId !== input.deviceId) throw new DeviceMismatchError();

  const record = await prisma.refreshToken.findUnique({ where: { userId_deviceId: { userId: payload.sub, deviceId: input.deviceId } } });
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now() || record.tokenHash !== hashOtp(input.refreshToken)) {
    throw new TokenRevokedError();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === UserStatus.SUSPENDED) throw new TokenRevokedError();

  const tokens = generateAuthTokens({
    userId: user.id,
    email: user.email,
    role: mapUserRoleToTokenRole(user.role),
    deviceId: input.deviceId,
    emailVerified: user.emailVerified,
    approvalStatus: user.approvalStatus,
  });

  await prisma.refreshToken.update({
    where: { userId_deviceId: { userId: user.id, deviceId: input.deviceId } },
    data: { tokenHash: hashOtp(tokens.refreshToken), expiresAt: tokens.refreshTokenExpiresAt, ipAddress: context.ipAddress, userAgent: context.userAgent },
  });

  return { ...tokens, tokenType: 'Bearer' };
}

export async function logout(input: LogoutRequestInput, context: { userId?: string } = {}): Promise<void> {
  if (!context.userId) throw new UnauthorizedError();
  const prisma = getPrismaClient();
  await prisma.refreshToken.update({
    where: { userId_deviceId: { userId: context.userId, deviceId: input.deviceId } },
    data: { revokedAt: new Date() },
  });
}

// === FORGOT / RESET PASSWORD FLOW ===

export async function requestPasswordReset(input: ForgotPasswordRequestInput, context: { locale?: string | null } = {}): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  if (!user) return;
  const code = String(randomInt(100000, 1000000)).padStart(6, '0');
  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    update: { codeHash: hashOtp(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000), consumedAt: null, failedAttempts: 0 },
    create: { userId: user.id, codeHash: hashOtp(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const queue = getEmailVerificationQueueContext();
  await queue.add('password-reset', { userId: user.id, email: user.email, verificationCode: code, locale: context.locale });
}

export async function resetPassword(input: ResetPasswordRequestInput): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(input.email) }, include: { passwordResetToken: true } });
  if (!user || !user.passwordResetToken) throw new InvalidCredentialsError();
  const token = user.passwordResetToken;
  if (token.consumedAt || token.expiresAt.getTime() <= Date.now() || hashOtp(input.code) !== token.codeHash) {
    throw new InvalidCredentialsError();
  }
  const newHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
    prisma.passwordResetToken.update({ where: { userId: user.id }, data: { consumedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
  ]);
}

// === STUBS FOR OTHER FLOWS ===
export async function verifyPhone() { throw new Error('Not implemented'); }
export async function resendPhoneVerification() { throw new Error('Not implemented'); }
export async function getCurrentUserProfile() { throw new Error('Not implemented'); }
export async function changePassword() { throw new Error('Not implemented'); }
