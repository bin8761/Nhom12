import { randomUUID, generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { loadAppConfig } from '../config/appConfig';

type UserRole = 'candidate' | 'employer' | 'admin';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface GenerateTokenParams {
  userId: string;
  email: string;
  role: UserRole;
  deviceId: string;
  emailVerified: boolean;
  approvalStatus?: ApprovalStatus;
}

export interface GeneratedAuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  refreshTokenExpiresAt: Date;
  refreshTokenJti: string;
}

let fallbackKeyPair: { privateKey: string; publicKey: string } | null = null;
let fallbackWarningLogged = false;

function ensureFallbackKeyPair(): { privateKey: string; publicKey: string } {
  if (fallbackKeyPair) {
    return fallbackKeyPair;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  fallbackKeyPair = {
    privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };

  if (!fallbackWarningLogged) {
    fallbackWarningLogged = true;
    console.warn('[Auth Tokens] JWT keys not provided. Using ephemeral development key pair.');
  }

  return fallbackKeyPair;
}

function resolvePrivateKey(): string {
  const config = loadAppConfig();
  if (config.jwt.privateKey) {
    return config.jwt.privateKey;
  }

  return ensureFallbackKeyPair().privateKey;
}

export function resolvePublicKey(): string | undefined {
  const config = loadAppConfig();
  if (config.jwt.publicKey) {
    return config.jwt.publicKey;
  }

  const fallback = fallbackKeyPair ?? ensureFallbackKeyPair();
  return fallback.publicKey;
}

export function generateAuthTokens(params: GenerateTokenParams): GeneratedAuthTokens {
  const config = loadAppConfig();
  const privateKey = resolvePrivateKey();
  const accessTokenExpiresIn = config.authTokens.accessTokenTtlSeconds;
  const refreshTokenExpiresIn = config.authTokens.refreshTokenTtlDays * 24 * 60 * 60;
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);
  const refreshTokenJti = randomUUID();

  const accessPayload: Record<string, unknown> = {
    sub: params.userId,
    email: params.email,
    role: params.role,
    emailVerified: params.emailVerified,
    deviceId: params.deviceId,
    tokenUse: 'access',
  };

  if (params.approvalStatus) {
    accessPayload.approvalStatus = params.approvalStatus;
  }

  const accessToken = jwt.sign(accessPayload, privateKey, {
    algorithm: config.jwt.algorithm,
    expiresIn: accessTokenExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });

  const refreshPayload: Record<string, unknown> = {
    sub: params.userId,
    email: params.email,
    role: params.role,
    deviceId: params.deviceId,
    tokenUse: 'refresh',
    jti: refreshTokenJti,
  };

  if (params.approvalStatus) {
    refreshPayload.approvalStatus = params.approvalStatus;
  }

  const refreshToken = jwt.sign(refreshPayload, privateKey, {
    algorithm: config.jwt.algorithm,
    expiresIn: refreshTokenExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
    refreshTokenExpiresAt,
    refreshTokenJti,
  };
}
