"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initApprovalNotificationWorker = initApprovalNotificationWorker;
exports.shutdownApprovalNotificationWorker = shutdownApprovalNotificationWorker;
const bullmq_1 = require("bullmq");
const approvalNotificationQueue_1 = require("./approvalNotificationQueue");
const smtpMailer_1 = require("../infra/email/smtpMailer");
const prismaClient_1 = require("../infra/prisma/prismaClient");
const logger_1 = __importDefault(require("../utils/logger"));
const redisClient_1 = require("../infra/redis/redisClient");
let workerInstance = null;
function initApprovalNotificationWorker(redis) {
    if (workerInstance) {
        return workerInstance;
    }
    const connection = (0, redisClient_1.duplicateRedisConnection)(redis);
    workerInstance = new bullmq_1.Worker(approvalNotificationQueue_1.APPROVAL_NOTIFICATION_QUEUE_NAME, async (job) => {
        const prisma = (0, prismaClient_1.getPrismaClient)();
        const jobId = job.id ? String(job.id) : undefined;
        const { userId, email, status, approvedBy, reason } = job.data;
        logger_1.default.info({
            event: 'approval_notification_job_started',
            jobId: job.id,
            userId,
            email,
            status,
        });
        // Upsert outbox record on start
        await prisma.emailOutbox.upsert({
            where: { jobId: jobId ?? '' },
            update: {
                status: 'RETRYING',
                attempts: { increment: 1 },
                lastAttemptAt: new Date(),
            },
            create: {
                jobId: jobId,
                userId: userId,
                email: email,
                templateKey: `employer.approval.${status}`,
                status: 'PENDING',
                attempts: 1,
                lastAttemptAt: new Date(),
            },
        });
        try {
            // Send appropriate email based on status
            switch (status) {
                case 'approved':
                    await (0, smtpMailer_1.sendEmployerApprovedEmail)({
                        userId,
                        to: email,
                        approvedBy: approvedBy || 'system',
                    });
                    break;
                case 'pending':
                    await (0, smtpMailer_1.sendEmployerPendingReviewEmail)({
                        userId,
                        to: email,
                        reason: reason || 'Your registration is under review',
                    });
                    break;
                case 'rejected':
                    await (0, smtpMailer_1.sendEmployerPendingReviewEmail)({
                        userId,
                        to: email,
                        reason: reason || 'Your registration was not approved',
                    });
                    break;
                default:
                    throw new Error(`Unknown approval status: ${status}`);
            }
            // Update outbox status to sent
            await prisma.emailOutbox.update({
                where: { jobId: jobId ?? '' },
                data: {
                    status: 'SENT',
                },
            });
            logger_1.default.info({
                event: 'approval_notification_job_completed',
                jobId: job.id,
                userId,
                email,
                status,
                attemptsMade: job.attemptsMade,
            });
        }
        catch (error) {
            // Update outbox status to failed
            await prisma.emailOutbox.update({
                where: { jobId: jobId ?? '' },
                data: {
                    status: 'FAILED',
                    lastError: error instanceof Error ? error.message : String(error),
                },
            });
            logger_1.default.error({
                event: 'approval_notification_job_failed',
                jobId: job.id,
                userId,
                email,
                status,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, { connection });
    workerInstance.on('failed', async (job, error) => {
        logger_1.default.error({
            event: 'approval_notification_job_failed',
            jobId: job?.id,
            userId: job?.data?.userId,
            email: job?.data?.email,
            status: job?.data?.status,
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
                        templateKey: `employer.approval.${job?.data?.status}`,
                        status: 'FAILED',
                        attempts: job?.attemptsMade ?? 1,
                        lastError: error instanceof Error ? error.message : String(error),
                        lastAttemptAt: new Date(),
                    },
                });
            }
        }
        catch (e) {
            logger_1.default.error({ event: 'approval_notification_outbox_update_failed', error: e instanceof Error ? e.message : String(e) });
        }
    });
    workerInstance.on('error', (error) => {
        logger_1.default.error({
            event: 'approval_notification_worker_error',
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return workerInstance;
}
async function shutdownApprovalNotificationWorker() {
    if (!workerInstance) {
        return;
    }
    await workerInstance.close();
    workerInstance = null;
}
//# sourceMappingURL=approvalNotificationWorker.js.map