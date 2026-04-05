"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.resendVerification = resendVerification;
exports.verifyEmail = verifyEmail;
exports.resendPhoneVerification = resendPhoneVerification;
exports.verifyPhone = verifyPhone;
exports.getCurrentUserProfile = getCurrentUserProfile;
exports.changePassword = changePassword;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.logout = logout;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = require("../infra/prisma/prismaClient");
const appConfig_1 = require("../config/appConfig");
const tokenGenerator_1 = require("../utils/tokenGenerator");
const appContext_1 = require("../container/appContext");
const authEvents_1 = require("../events/authEvents");
const logger_1 = __importDefault(require("../utils/logger"));
const jobSync_service_1 = require("./jobSync.service");
const phoneVerificationMetrics_1 = require("../metrics/phoneVerificationMetrics");
const passwordMetrics_1 = require("../metrics/passwordMetrics");
const errors_1 = require("../utils/errors");
const PHONE_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_OTP_TTL_MS = 1 * 60 * 1000;
const PASSWORD_RESET_RATE_LIMIT_MAX = 5;
const PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
function parseDateOfBirth(value) {
    const [dayStr, monthStr, yearStr] = value.split('/');
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    // Use UTC to avoid timezone issues
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
function formatDateOfBirth(date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}
async function enforcePhoneOtpResendLimit(userId, limit) {
    if (limit <= 0) {
        return;
    }
    const redis = (0, appContext_1.getRedisConnection)();
    const redisKey = `rate:phone-otp:${userId}`;
    const currentCount = await redis.incr(redisKey);
    if (currentCount === 1) {
        await redis.expire(redisKey, 60 * 60);
    }
    if (currentCount > limit) {
        const ttl = await redis.ttl(redisKey);
        throw new errors_1.RateLimitExceededError(ttl > 0
            ? `Đã vượt quá giới hạn gửi lại mã xác thực điện thoại. Vui lòng thử lại sau ${ttl} giây.`
            : 'Đã vượt quá giới hạn gửi lại mã xác thực điện thoại. Vui lòng thử lại sau.');
    }
}
function mapUserRoleToTokenRole(role) {
    switch (role) {
        case client_1.UserRole.CANDIDATE:
            return 'candidate';
        case client_1.UserRole.EMPLOYER:
            return 'employer';
        case client_1.UserRole.ADMIN:
        default:
            return 'admin';
    }
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashOtp(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
function logLoginAttempt({ email, deviceId, result, reason, userId, requestId, }) {
    logger_1.default.info({
        event: 'login',
        email,
        deviceId,
        result,
        reason,
        userId,
        requestId: requestId ?? undefined,
    });
}
function logRefreshAttempt({ email, deviceId, result, reason, userId, requestId, }) {
    logger_1.default.info({
        event: 'refresh',
        email,
        deviceId,
        result,
        reason,
        userId,
        requestId: requestId ?? undefined,
    });
}
function logResendAttempt({ email, result, reason, requestId, }) {
    logger_1.default.info({
        event: 'resend_verification',
        email,
        result,
        reason,
        requestId: requestId ?? undefined,
    });
}
function logLogoutAttempt({ deviceId, result, reason, userId, email, requestId, }) {
    logger_1.default.info({
        event: 'logout',
        deviceId,
        result,
        reason,
        userId,
        email,
        requestId: requestId ?? undefined,
    });
}
function verifyRefreshToken(token) {
    const config = (0, appConfig_1.loadAppConfig)();
    const publicKey = (0, tokenGenerator_1.resolvePublicKey)();
    if (!publicKey) {
        throw new errors_1.TokenRevokedError('Khóa xác thực refresh token không khả dụng');
    }
    try {
        return jsonwebtoken_1.default.verify(token, publicKey, {
            algorithms: [config.jwt.algorithm],
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new errors_1.TokenExpiredError();
        }
        throw new errors_1.TokenRevokedError('Refresh token is invalid or malformed');
    }
}
async function register(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const config = (0, appConfig_1.loadAppConfig)();
    const email = normalizeEmail(input.email);
    const deviceId = input.deviceId?.trim() || (0, crypto_1.randomUUID)();
    const ipAddress = context.ipAddress ?? null;
    const userAgent = context.userAgent ?? null;
    const locale = context.locale ?? undefined;
    const passwordHash = await bcrypt_1.default.hash(input.password, 12);
    const verificationCode = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
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
                const emailOtp = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
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
                        approvalStatus: existing.role === client_1.UserRole.CANDIDATE ? client_1.ApprovalStatus.APPROVED : existing.approvalStatus,
                    },
                });
                await prisma.emailVerification.upsert({
                    where: { userId: existing.id },
                    update: { codeHash: emailOtpHash, expiresAt: emailOtpExpiresAt, sentCount: { increment: 1 }, lastSentAt: now },
                    create: { userId: existing.id, codeHash: emailOtpHash, expiresAt: emailOtpExpiresAt, sentCount: 1, lastSentAt: now },
                });
                const emailQueue = (0, appContext_1.getEmailVerificationQueueContext)();
                await emailQueue.add('send', { userId: existing.id, email: existing.email, verificationCode: emailOtp, locale });
                const tokens = (0, tokenGenerator_1.generateAuthTokens)({
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
                };
            }
            // Already verified ? conflict
            throw new errors_1.ConflictError('Email đã được đăng ký');
        }
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    role: input.role === 'candidate' ? client_1.UserRole.CANDIDATE : client_1.UserRole.EMPLOYER,
                    status: client_1.UserStatus.PENDING,
                    approvalStatus: input.role === 'candidate' ? client_1.ApprovalStatus.APPROVED : client_1.ApprovalStatus.PENDING,
                    emailVerified: false,
                    fullName: input.fullName,
                    dateOfBirth: parsedDateOfBirth,
                    address: normalizedAddress,
                    phoneNumber: normalizedPhoneNumber,
                    phoneVerified: false,
                    phoneVerifiedAt: null,
                },
            });
            const tokens = (0, tokenGenerator_1.generateAuthTokens)({
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
            if (user.role === client_1.UserRole.CANDIDATE) {
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
            }
            else if (user.role === client_1.UserRole.EMPLOYER) {
                await tx.employerProfile.create({
                    data: {
                        userId: user.id,
                        companyName: input.companyName || input.fullName,
                        headquartersLocation: normalizedAddress,
                        contactPhone: normalizedPhoneNumber,
                        contactEmail: email,
                        companyWebsite: input.companyWebsite || null,
                        updatedBy: user.id,
                    },
                });
            }
            const response = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                tokenType: 'Bearer',
                expiresIn: tokens.accessTokenExpiresIn,
                refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
            };
            const emailVerificationJob = {
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
        const emailQueue = (0, appContext_1.getEmailVerificationQueueContext)();
        await emailQueue.add('send', result.emailVerificationJob);
        await (0, authEvents_1.publishAuthUserRegisteredEvent)({
            id: result.emailVerificationJob.userId,
            email,
            role: input.role,
            emittedAt: new Date().toISOString(),
        });
        logger_1.default.info({
            event: 'register',
            result: 'success',
            userId: result.emailVerificationJob.userId,
            email,
        });
        return {
            ...result.response,
            phoneVerificationRequired: true,
        };
    }
    catch (error) {
        logger_1.default.info({
            event: 'register',
            result: 'failure',
            email,
            reason: error instanceof Error ? error.message : 'unknown_error',
        });
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new errors_1.ConflictError('Email đã được đăng ký');
        }
        throw error;
    }
}
async function login(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const email = normalizeEmail(input.email);
    const deviceId = input.deviceId.trim();
    const ipAddress = context.ipAddress ?? null;
    const userAgent = context.userAgent ?? null;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        logLoginAttempt({ email, deviceId, result: 'failure', reason: 'user_not_found', requestId: context.requestId });
        throw new errors_1.InvalidCredentialsError();
    }
    const passwordValid = await bcrypt_1.default.compare(input.password, user.passwordHash);
    if (!passwordValid) {
        logLoginAttempt({ email, deviceId, result: 'failure', reason: 'invalid_password', userId: user.id, requestId: context.requestId });
        throw new errors_1.InvalidCredentialsError();
    }
    if (user.status === client_1.UserStatus.SUSPENDED) {
        logLoginAttempt({ email, deviceId, result: 'failure', reason: 'account_suspended', userId: user.id, requestId: context.requestId });
        throw new errors_1.AccountSuspendedError();
    }
    if (!user.emailVerified) {
        logLoginAttempt({ email, deviceId, result: 'failure', reason: 'email_not_verified', userId: user.id, requestId: context.requestId });
        throw new errors_1.EmailNotVerifiedError();
    }
    const tokens = (0, tokenGenerator_1.generateAuthTokens)({
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
async function refresh(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const payload = verifyRefreshToken(input.refreshToken);
    if (payload.tokenUse !== 'refresh') {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'wrong_token_use', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Token không phải là refresh token');
    }
    if (!payload.sub) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'missing_sub', email: payload.email, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Refresh token thiếu thông tin subject');
    }
    if (!payload.deviceId) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'missing_device_id', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Refresh token thiếu thông tin device id');
    }
    if (payload.deviceId !== input.deviceId) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'device_mismatch', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.DeviceMismatchError();
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
        throw new errors_1.TokenRevokedError('Không tìm thấy bản ghi refresh token');
    }
    if (refreshRecord.revokedAt) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'token_revoked', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Refresh token đã bị thu hồi');
    }
    if (refreshRecord.expiresAt.getTime() <= Date.now()) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'token_expired', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenExpiredError();
    }
    if (refreshRecord.tokenHash !== hashedIncomingToken) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'hash_mismatch', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Refresh token đã được xoay vòng hoặc không hợp lệ');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'user_not_found', email: payload.email, userId: payload.sub, requestId: context.requestId });
        throw new errors_1.TokenRevokedError('Tài khoản không còn tồn tại');
    }
    if (user.status === client_1.UserStatus.SUSPENDED) {
        logRefreshAttempt({ deviceId: input.deviceId, result: 'failure', reason: 'account_suspended', email: user.email, userId: user.id, requestId: context.requestId });
        throw new errors_1.AccountSuspendedError();
    }
    const tokens = (0, tokenGenerator_1.generateAuthTokens)({
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
async function resendVerification(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const email = normalizeEmail(input.email);
    const requestId = context.requestId ?? null;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        logResendAttempt({ email, result: 'failure', reason: 'user_not_found', requestId });
        throw new errors_1.NotFoundError('User not found');
    }
    if (user.emailVerified) {
        logResendAttempt({ email, result: 'failure', reason: 'already_verified', requestId });
        throw new errors_1.EmailAlreadyVerifiedError();
    }
    const code = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
    const codeHash = hashOtp(code);
    const config = (0, appConfig_1.loadAppConfig)();
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
    const queue = (0, appContext_1.getEmailVerificationQueueContext)();
    await queue.add('send', {
        userId: user.id,
        email: user.email,
        verificationCode: code,
        locale: context.locale ?? undefined,
    });
    logResendAttempt({ email, result: 'success', requestId });
}
async function verifyEmail(input) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const config = (0, appConfig_1.loadAppConfig)();
    const email = normalizeEmail(input.email);
    const code = input.code.trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    if (user.emailVerified) {
        return; // idempotent
    }
    const record = await prisma.emailVerification.findUnique({ where: { userId: user.id } });
    if (!record) {
        throw new errors_1.NotFoundError('Verification record not found');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
        throw new errors_1.TokenExpiredError('Verification code expired');
    }
    const providedHash = hashOtp(code);
    if (providedHash !== record.codeHash) {
        throw new errors_1.InvalidCredentialsError();
    }
    const updatedUser = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
            where: { id: user.id },
            data: { emailVerified: true, verifiedAt: new Date(), status: 'ACTIVE' },
        });
        await tx.emailVerification.delete({ where: { userId: user.id } });
        return updatedUser;
    });
    await (0, jobSync_service_1.syncCandidateToJobService)(updatedUser);
    // If this is an employer and auto-approval is enabled, trigger approval process
    if (updatedUser.role === 'EMPLOYER' && config.employerApproval.autoApproveEnabled) {
        try {
            const { getEmployerApprovalQueue } = await Promise.resolve().then(() => __importStar(require('../jobs/employerApprovalQueue')));
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
            logger_1.default.info({
                event: 'employer_approval_queued',
                userId: updatedUser.id,
                email: updatedUser.email,
                delaySeconds: config.employerApproval.delaySeconds,
            });
        }
        catch (error) {
            logger_1.default.error({
                event: 'employer_approval_queue_failed',
                userId: updatedUser.id,
                email: updatedUser.email,
                error: error instanceof Error ? error.message : String(error),
            });
            // Don't throw error - email verification should still succeed
        }
    }
}
async function resendPhoneVerification(input, context = {}) {
    if (!context.userId) {
        throw new errors_1.UnauthorizedError('User context missing for phone verification resend');
    }
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const requestId = context.requestId ?? null;
    const normalizedPhoneNumber = input.phoneNumber.trim();
    const config = (0, appConfig_1.loadAppConfig)();
    const user = await prisma.user.findUnique({ where: { id: context.userId } });
    if (!user) {
        logger_1.default.warn({
            event: 'phone_verification_resend_failed',
            reason: 'user_not_found',
            userId: context.userId,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.NotFoundError('User not found');
    }
    const storedPhone = user.phoneNumber?.trim();
    if (!storedPhone) {
        logger_1.default.warn({
            event: 'phone_verification_resend_failed',
            reason: 'phone_missing',
            userId: user.id,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.NotFoundError('Phone number not set for user');
    }
    if (storedPhone !== normalizedPhoneNumber) {
        logger_1.default.warn({
            event: 'phone_verification_resend_failed',
            reason: 'phone_mismatch',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
    }
    if (user.phoneVerified) {
        logger_1.default.info({
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
    const code = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
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
    const queue = (0, appContext_1.getPhoneVerificationQueueContext)();
    await queue.add('send', {
        userId: user.id,
        phoneNumber: normalizedPhoneNumber,
        code,
        origin: 'resend',
    });
    if (process.env.NODE_ENV !== 'production') {
        logger_1.default.info({
            event: 'phone_verification_code_debug',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            code,
            requestId: requestId ?? undefined,
        });
    }
    logger_1.default.info({
        event: 'phone_verification_resend_requested',
        userId: user.id,
        phoneNumber: normalizedPhoneNumber,
        requestId: requestId ?? undefined,
    });
}
async function verifyPhone(input, context = {}) {
    if (!context.userId) {
        throw new errors_1.UnauthorizedError('User context missing for phone verification');
    }
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const requestId = context.requestId ?? null;
    const normalizedPhoneNumber = input.phoneNumber.trim();
    const code = input.code.trim();
    const user = await prisma.user.findUnique({ where: { id: context.userId } });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    const storedPhone = user.phoneNumber?.trim() ?? null;
    if (!storedPhone || storedPhone !== normalizedPhoneNumber) {
        (0, phoneVerificationMetrics_1.recordPhoneOtpFailed)('phone_mismatch');
        logger_1.default.warn({
            event: 'phone_verification_failed',
            reason: 'phone_mismatch',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
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
            }
            catch (error) {
                if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
                    throw error;
                }
            }
        }
        return;
    }
    if (!verificationRecord) {
        (0, phoneVerificationMetrics_1.recordPhoneOtpFailed)('record_not_found');
        logger_1.default.warn({
            event: 'phone_verification_failed',
            reason: 'record_not_found',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.NotFoundError('Phone verification record not found');
    }
    if (verificationRecord.expiresAt.getTime() <= Date.now()) {
        try {
            await prisma.phoneVerification.delete({ where: { id: verificationRecord.id } });
        }
        catch (error) {
            if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
                throw error;
            }
        }
        (0, phoneVerificationMetrics_1.recordPhoneOtpFailed)('expired');
        logger_1.default.warn({
            event: 'phone_verification_failed',
            reason: 'expired',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.TokenExpiredError('Verification code expired');
    }
    const providedHash = hashOtp(code);
    if (providedHash !== verificationRecord.codeHash) {
        (0, phoneVerificationMetrics_1.recordPhoneOtpFailed)('invalid_code');
        logger_1.default.warn({
            event: 'phone_verification_failed',
            reason: 'invalid_code',
            userId: user.id,
            phoneNumber: normalizedPhoneNumber,
            requestId: requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
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
    logger_1.default.info({
        event: 'phone_verification_verified',
        userId: user.id,
        phoneNumber: normalizedPhoneNumber,
        requestId: requestId ?? undefined,
    });
    (0, phoneVerificationMetrics_1.recordPhoneOtpVerified)('other');
}
async function getCurrentUserProfile(userId) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    if (!user.fullName || !user.address || !user.phoneNumber || !user.dateOfBirth) {
        throw new errors_1.NotFoundError('User profile not found');
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
async function changePassword(context, currentPassword, newPassword) {
    if (!context.userId) {
        throw new errors_1.UnauthorizedError('User context missing for password change');
    }
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const user = await prisma.user.findUnique({ where: { id: context.userId } });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    const isCurrentValid = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
        (0, passwordMetrics_1.recordPasswordChange)('failure');
        logger_1.default.warn({
            event: 'password_change_failed',
            reason: 'invalid_current_password',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
    }
    if (currentPassword === newPassword) {
        (0, passwordMetrics_1.recordPasswordChange)('failure');
        logger_1.default.warn({
            event: 'password_change_failed',
            reason: 'password_unchanged',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.ConflictError('New password must be different from current password');
    }
    const newHash = await bcrypt_1.default.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: newHash,
            updatedAt: new Date(),
        },
    });
    (0, passwordMetrics_1.recordPasswordChange)('success');
    logger_1.default.info({
        event: 'password_change_success',
        userId: user.id,
        requestId: context.requestId ?? undefined,
    });
}
async function enforcePasswordResetRateLimit(email) {
    const redis = (0, appContext_1.getRedisConnection)();
    const key = `rate:password-reset:${email}`;
    const count = await redis.incr(key);
    if (count === 1) {
        await redis.expire(key, PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > PASSWORD_RESET_RATE_LIMIT_MAX) {
        const ttl = await redis.ttl(key);
        (0, passwordMetrics_1.recordPasswordResetRequest)('rate_limited');
        logger_1.default.warn({
            event: 'password_reset_request_rate_limited',
            email,
            ttlSeconds: ttl > 0 ? ttl : undefined,
        });
        throw new errors_1.RateLimitExceededError(ttl > 0
            ? `Too many password reset requests. Please try again in ${ttl} seconds.`
            : 'Too many password reset requests. Please try again later.');
    }
}
async function requestPasswordReset(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const email = normalizeEmail(input.email);
    await enforcePasswordResetRateLimit(email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        (0, passwordMetrics_1.recordPasswordResetRequest)('ignored');
        logger_1.default.info({
            event: 'password_reset_requested',
            result: 'ignored',
            reason: 'user_not_found',
            email,
            requestId: context.requestId ?? undefined,
        });
        return;
    }
    const now = new Date();
    const code = String((0, crypto_1.randomInt)(100000, 1000000)).padStart(6, '0');
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
    const emailQueue = (0, appContext_1.getEmailVerificationQueueContext)();
    await emailQueue.add('password-reset', {
        userId: user.id,
        email: user.email,
        verificationCode: code,
        locale: context.locale ?? undefined,
    });
    (0, passwordMetrics_1.recordPasswordResetRequest)('sent');
    logger_1.default.info({
        event: 'password_reset_requested',
        result: 'sent',
        userId: user.id,
        email: user.email,
        requestId: context.requestId ?? undefined,
    });
}
async function resetPassword(input, context = {}) {
    const prisma = (0, prismaClient_1.getPrismaClient)();
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'user_not_found',
            email,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
    }
    const token = await prisma.passwordResetToken.findUnique({ where: { userId: user.id } });
    if (!token) {
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'token_not_found',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.InvalidCredentialsError();
    }
    if (token.failedAttempts >= 5) {
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'locked_out',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.RateLimitExceededError('Quá nhiều lần thử sai. Vui lòng yêu cầu mã OTP mới.');
    }
    if (token.consumedAt) {
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'token_consumed',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.TokenExpiredError('Reset code already used');
    }
    if (token.expiresAt.getTime() <= Date.now()) {
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'expired',
            userId: user.id,
            requestId: context.requestId ?? undefined,
        });
        throw new errors_1.TokenExpiredError('Reset code expired');
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
        (0, passwordMetrics_1.recordPasswordResetResult)('failure');
        logger_1.default.warn({
            event: 'password_reset_failed',
            reason: 'invalid_code',
            userId: user.id,
            requestId: context.requestId ?? undefined,
            failedAttempts: updatedToken.failedAttempts,
        });
        if (updatedToken.failedAttempts >= 5) {
            throw new errors_1.RateLimitExceededError('Quá nhiều lần thử sai. Vui lòng yêu cầu mã OTP mới.');
        }
        throw new errors_1.InvalidCredentialsError();
    }
    const newHash = await bcrypt_1.default.hash(input.newPassword, 12);
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
    (0, passwordMetrics_1.recordPasswordResetResult)('success');
    logger_1.default.info({
        event: 'password_reset_success',
        userId: user.id,
        requestId: context.requestId ?? undefined,
    });
}
async function logout(input, context = {}) {
    if (!context.userId) {
        throw new errors_1.UnauthorizedError('User context missing for logout');
    }
    const prisma = (0, prismaClient_1.getPrismaClient)();
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
        throw new errors_1.NotFoundError('Active refresh token for this device was not found');
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
//# sourceMappingURL=auth.service.js.map