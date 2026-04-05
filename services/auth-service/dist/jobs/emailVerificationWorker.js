"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initEmailVerificationWorker = initEmailVerificationWorker;
exports.shutdownEmailVerificationWorker = shutdownEmailVerificationWorker;
const bullmq_1 = require("bullmq");
const emailVerificationQueue_1 = require("./emailVerificationQueue");
const smtpMailer_1 = require("../infra/email/smtpMailer");
const logger_1 = __importDefault(require("../utils/logger"));
const prismaClient_1 = require("../infra/prisma/prismaClient");
const redisClient_1 = require("../infra/redis/redisClient");
let workerInstance = null;
function initEmailVerificationWorker(redis) {
    if (workerInstance) {
        return workerInstance;
    }
    const connection = (0, redisClient_1.duplicateRedisConnection)(redis);
    workerInstance = new bullmq_1.Worker(emailVerificationQueue_1.EMAIL_VERIFICATION_QUEUE_NAME, async (job) => {
        const prisma = (0, prismaClient_1.getPrismaClient)();
        const jobId = job.id ? String(job.id) : undefined;
        // upsert outbox record on start
        const templateKey = job.name === 'password-reset' ? 'auth.password.reset' : 'auth.email.verification';
        await prisma.emailOutbox.upsert({
            where: { jobId: jobId ?? '' },
            update: {
                status: 'RETRYING',
                attempts: { increment: 1 },
                lastAttemptAt: new Date(),
            },
            create: {
                jobId: jobId,
                userId: job.data.userId,
                email: job.data.email,
                templateKey,
                status: 'PENDING',
                attempts: 1,
                lastAttemptAt: new Date(),
            },
        });
        logger_1.default.info({
            event: job.name === 'password-reset' ? 'password_reset_email_job_started' : 'email_verification_job_started',
            jobId: job.id,
            userId: job.data.userId,
            email: job.data.email,
            attemptsMade: job.attemptsMade,
        });
        if (job.name === 'password-reset') {
            await (0, smtpMailer_1.sendPasswordResetEmail)({
                userId: job.data.userId,
                to: job.data.email,
                code: job.data.verificationCode,
                locale: job.data.locale,
            });
            logger_1.default.info({
                event: 'password_reset_email_sent',
                jobId: job.id,
                userId: job.data.userId,
                email: job.data.email,
            });
        }
        else {
            await (0, smtpMailer_1.sendVerificationEmail)({
                userId: job.data.userId,
                to: job.data.email,
                code: job.data.verificationCode,
                locale: job.data.locale,
            });
        }
        await prisma.emailOutbox.update({
            where: { jobId: jobId ?? '' },
            data: {
                status: 'SENT',
            },
        });
        logger_1.default.info({
            event: job.name === 'password-reset' ? 'password_reset_email_job_completed' : 'email_verification_job_completed',
            jobId: job.id,
            userId: job.data.userId,
            email: job.data.email,
            attemptsMade: job.attemptsMade,
        });
    }, {
        connection,
    });
    workerInstance.on('failed', async (job, error) => {
        logger_1.default.error({
            event: job?.name === 'password-reset' ? 'password_reset_email_job_failed' : 'email_verification_job_failed',
            jobId: job?.id,
            userId: job?.data?.userId,
            email: job?.data?.email,
            attemptsMade: job?.attemptsMade,
            error: error instanceof Error ? error.message : String(error),
        });
        try {
            const prisma = (0, prismaClient_1.getPrismaClient)();
            const jobId = job?.id ? String(job.id) : undefined;
            if (jobId) {
                await prisma.emailOutbox.upsert({
                    where: { jobId },
                    update: {
                        status: job.attemptsMade < (job.opts.attempts ?? 1) ? 'RETRYING' : 'FAILED',
                        attempts: job.attemptsMade,
                        lastError: error instanceof Error ? error.message : String(error),
                        lastAttemptAt: new Date(),
                    },
                    create: {
                        jobId,
                        userId: job?.data?.userId,
                        email: job?.data?.email ?? 'unknown',
                        templateKey: job?.name === 'password-reset' ? 'auth.password.reset' : 'auth.email.verification',
                        status: 'FAILED',
                        attempts: job?.attemptsMade ?? 1,
                        lastError: error instanceof Error ? error.message : String(error),
                        lastAttemptAt: new Date(),
                    },
                });
            }
        }
        catch (e) {
            logger_1.default.error({ event: 'email_outbox_update_failed', error: e instanceof Error ? e.message : String(e) });
        }
    });
    workerInstance.on('error', (error) => {
        logger_1.default.error({
            event: 'email_verification_worker_error',
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return workerInstance;
}
async function shutdownEmailVerificationWorker() {
    if (!workerInstance) {
        return;
    }
    await workerInstance.close();
    workerInstance = null;
}
//# sourceMappingURL=emailVerificationWorker.js.map