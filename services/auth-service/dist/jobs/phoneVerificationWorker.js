"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPhoneVerificationWorker = initPhoneVerificationWorker;
exports.shutdownPhoneVerificationWorker = shutdownPhoneVerificationWorker;
const bullmq_1 = require("bullmq");
const phoneVerificationQueue_1 = require("./phoneVerificationQueue");
const smsProvider_1 = require("../infra/sms/smsProvider");
const prismaClient_1 = require("../infra/prisma/prismaClient");
const logger_1 = __importDefault(require("../utils/logger"));
const redisClient_1 = require("../infra/redis/redisClient");
const phoneVerificationMetrics_1 = require("../metrics/phoneVerificationMetrics");
let workerInstance = null;
function initPhoneVerificationWorker(redis) {
    if (workerInstance) {
        return workerInstance;
    }
    const connection = (0, redisClient_1.duplicateRedisConnection)(redis);
    workerInstance = new bullmq_1.Worker(phoneVerificationQueue_1.PHONE_VERIFICATION_QUEUE_NAME, async (job) => {
        const prisma = (0, prismaClient_1.getPrismaClient)();
        const now = new Date();
        logger_1.default.info({
            event: 'phone_verification_job_started',
            jobId: job.id,
            userId: job.data.userId,
            phoneNumber: job.data.phoneNumber,
            attemptsMade: job.attemptsMade,
        });
        const data = {
            lastSentAt: now,
        };
        if (job.attemptsMade > 1) {
            data.sentCount = { increment: 1 };
        }
        const result = await prisma.phoneVerification.updateMany({
            where: {
                userId: job.data.userId,
                phoneNumber: job.data.phoneNumber,
            },
            data,
        });
        if (result.count === 0) {
            logger_1.default.warn({
                event: 'phone_verification_record_missing',
                jobId: job.id,
                userId: job.data.userId,
                phoneNumber: job.data.phoneNumber,
            });
        }
        await (0, smsProvider_1.sendPhoneVerificationSms)({
            userId: job.data.userId,
            phoneNumber: job.data.phoneNumber,
            code: job.data.code,
        });
        (0, phoneVerificationMetrics_1.recordPhoneOtpSent)(job.data.origin);
        logger_1.default.info({
            event: 'phone_verification_sent',
            jobId: job.id,
            userId: job.data.userId,
            phoneNumber: job.data.phoneNumber,
            attemptsMade: job.attemptsMade,
        });
        logger_1.default.info({
            event: 'phone_verification_job_completed',
            jobId: job.id,
            userId: job.data.userId,
            phoneNumber: job.data.phoneNumber,
            attemptsMade: job.attemptsMade,
        });
    }, {
        connection,
    });
    workerInstance.on('failed', (job, error) => {
        (0, phoneVerificationMetrics_1.recordPhoneOtpFailed)('send_failed');
        (0, phoneVerificationMetrics_1.recordPhoneOtpWorkerFailed)('send_failed');
        logger_1.default.error({
            event: 'phone_verification_failed',
            reason: 'sms_send_failed',
            jobId: job?.id,
            userId: job?.data?.userId,
            phoneNumber: job?.data?.phoneNumber,
            attemptsMade: job?.attemptsMade,
            error: error instanceof Error ? error.message : String(error),
        });
        logger_1.default.error({
            event: 'phone_verification_job_failed',
            jobId: job?.id,
            userId: job?.data?.userId,
            phoneNumber: job?.data?.phoneNumber,
            attemptsMade: job?.attemptsMade,
            error: error instanceof Error ? error.message : String(error),
        });
        logger_1.default.error({
            event: 'phone_verification_worker_alert',
            severity: 'critical',
            jobId: job?.id,
            userId: job?.data?.userId,
            phoneNumber: job?.data?.phoneNumber,
            error: error instanceof Error ? error.message : String(error),
        });
    });
    workerInstance.on('error', (error) => {
        (0, phoneVerificationMetrics_1.recordPhoneOtpWorkerFailed)('worker_error');
        logger_1.default.error({
            event: 'phone_verification_worker_error',
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return workerInstance;
}
async function shutdownPhoneVerificationWorker() {
    if (!workerInstance) {
        return;
    }
    await workerInstance.close();
    workerInstance = null;
}
//# sourceMappingURL=phoneVerificationWorker.js.map