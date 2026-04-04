import { Prisma, UserRole, UserStatus, ApprovalStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { loadAppConfig } from '../config/appConfig';
import { generateAuthTokens } from '../utils/tokenGenerator';
import {
  getEmailVerificationQueueContext,
} from '../container/appContext';
import { publishAuthUserRegisteredEvent } from '../events/authEvents';
import type {
  AuthTokensResponse,
  RegisterRequestInput,
  ResendVerificationRequestInput,
  VerifyEmailRequestInput,
  VerifyPhoneRequestInput,
  ResendPhoneOtpRequestInput,
} from '../schemas/authSchemas';
import { InvalidCredentialsError } from '../utils/errors';

// === REGISTRATION FLOW ONLY ===

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

export async function resendPhoneVerification(
  input: ResendPhoneOtpRequestInput,
  context: { userId: string }
): Promise<void> { /* Not implemented on this branch */ }

export async function verifyPhone(
  input: VerifyPhoneRequestInput,
  context: { userId: string }
): Promise<void> { /* Not implemented on this branch */ }

export async function login() { throw new Error('Not implemented'); }
export async function logout() { throw new Error('Not implemented'); }
export async function refresh() { throw new Error('Not implemented'); }
export async function requestPasswordReset() { throw new Error('Not implemented'); }
export async function resetPassword() { throw new Error('Not implemented'); }
export async function getCurrentUserProfile() { throw new Error('Not implemented'); }
export async function changePassword() { throw new Error('Not implemented'); }
