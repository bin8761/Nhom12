"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const errors_1 = require("../../utils/errors");
const auth_service_1 = require("../auth.service");
const queueAddMock = jest.fn();
const phoneQueueMock = { add: queueAddMock };
const emailQueueMock = { add: jest.fn() };
const redisMock = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
};
jest.mock('../../container/appContext', () => ({
    getPhoneVerificationQueueContext: jest.fn(() => phoneQueueMock),
    getEmailVerificationQueueContext: jest.fn(() => emailQueueMock),
    getRedisConnection: jest.fn(() => redisMock),
}));
const recordPhoneOtpFailedMock = jest.fn();
const recordPhoneOtpVerifiedMock = jest.fn();
jest.mock('../../metrics/phoneVerificationMetrics', () => ({
    recordPhoneOtpFailed: (...args) => recordPhoneOtpFailedMock(...args),
    recordPhoneOtpVerified: (...args) => recordPhoneOtpVerifiedMock(...args),
}));
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    phoneVerification: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
};
jest.mock('../../infra/prisma/prismaClient', () => ({
    getPrismaClient: jest.fn(() => mockPrisma),
}));
describe('auth.service phone verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisMock.incr.mockResolvedValue(1);
        redisMock.expire.mockResolvedValue(1);
        redisMock.ttl.mockResolvedValue(30);
        queueAddMock.mockResolvedValue(undefined);
    });
    describe('resendPhoneVerification', () => {
        const context = { userId: 'user-1', requestId: 'req-1' };
        const phoneNumber = '0912345678';
        it('enqueues OTP when user is eligible', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: context.userId,
                phoneNumber,
                phoneVerified: false,
            });
            mockPrisma.phoneVerification.upsert.mockResolvedValue({});
            await expect((0, auth_service_1.resendPhoneVerification)({ phoneNumber }, context)).resolves.toBeUndefined();
            expect(redisMock.incr).toHaveBeenCalledWith(`rate:phone-otp:${context.userId}`);
            expect(mockPrisma.phoneVerification.upsert).toHaveBeenCalled();
            expect(queueAddMock).toHaveBeenCalledWith('send', expect.objectContaining({
                userId: context.userId,
                phoneNumber,
                origin: 'resend',
            }));
            expect(recordPhoneOtpFailedMock).not.toHaveBeenCalled();
        });
        it('throws rate limit error when exceeding quota', async () => {
            redisMock.incr.mockResolvedValue(10);
            mockPrisma.user.findUnique.mockResolvedValue({
                id: context.userId,
                phoneNumber,
                phoneVerified: false,
            });
            await expect((0, auth_service_1.resendPhoneVerification)({ phoneNumber }, context)).rejects.toBeInstanceOf(errors_1.RateLimitExceededError);
            expect(queueAddMock).not.toHaveBeenCalled();
            expect(mockPrisma.phoneVerification.upsert).not.toHaveBeenCalled();
        });
    });
    describe('verifyPhone', () => {
        const context = { userId: 'user-1', requestId: 'req-42' };
        const phoneNumber = '0912345678';
        const code = '123456';
        const codeHash = (0, crypto_1.createHash)('sha256').update(code).digest('hex');
        beforeEach(() => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: context.userId,
                phoneNumber,
                phoneVerified: false,
            });
            mockPrisma.phoneVerification.findUnique.mockResolvedValue({
                id: 'pv-1',
                userId: context.userId,
                phoneNumber,
                codeHash,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            mockPrisma.user.update.mockResolvedValue({});
            mockPrisma.phoneVerification.delete.mockResolvedValue({});
        });
        it('verifies phone and clears record when code matches', async () => {
            await expect((0, auth_service_1.verifyPhone)({ phoneNumber, code }, context)).resolves.toBeUndefined();
            expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: context.userId },
            }));
            expect(mockPrisma.phoneVerification.delete).toHaveBeenCalledWith({
                where: { id: 'pv-1' },
            });
            expect(recordPhoneOtpVerifiedMock).toHaveBeenCalledWith('other');
            expect(recordPhoneOtpFailedMock).not.toHaveBeenCalled();
        });
        it('throws InvalidCredentialsError when code mismatch', async () => {
            mockPrisma.phoneVerification.findUnique.mockResolvedValue({
                id: 'pv-1',
                userId: context.userId,
                phoneNumber,
                codeHash: (0, crypto_1.createHash)('sha256').update('000000').digest('hex'),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            await expect((0, auth_service_1.verifyPhone)({ phoneNumber, code }, context)).rejects.toBeInstanceOf(errors_1.InvalidCredentialsError);
            expect(recordPhoneOtpFailedMock).toHaveBeenCalledWith('invalid_code');
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });
        it('throws TokenExpiredError when record expired', async () => {
            mockPrisma.phoneVerification.findUnique.mockResolvedValue({
                id: 'pv-1',
                userId: context.userId,
                phoneNumber,
                codeHash,
                expiresAt: new Date(Date.now() - 1),
            });
            await expect((0, auth_service_1.verifyPhone)({ phoneNumber, code }, context)).rejects.toBeInstanceOf(errors_1.TokenExpiredError);
            expect(recordPhoneOtpFailedMock).toHaveBeenCalledWith('expired');
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=auth.service.test.js.map