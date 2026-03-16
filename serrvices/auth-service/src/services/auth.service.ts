import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { generateAuthTokens } from '../utils/tokenGenerator';
import logger from '../utils/logger';
import {
  AccountSuspendedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../utils/errors';
import type { AuthTokensResponse, LoginRequestInput } from '../schemas/authSchemas';

type LoginResult = 'success' | 'failure';

type TokenRole = 'candidate' | 'employer' | 'admin';

export interface LoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
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
    approvalStatus: user.approvalStatus ?? undefined,
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
