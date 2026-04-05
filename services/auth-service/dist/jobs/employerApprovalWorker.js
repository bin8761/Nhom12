"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initEmployerApprovalWorker = initEmployerApprovalWorker;
exports.shutdownEmployerApprovalWorker = shutdownEmployerApprovalWorker;
const bullmq_1 = require("bullmq");
const employerApprovalQueue_1 = require("./employerApprovalQueue");
const prismaClient_1 = require("../infra/prisma/prismaClient");
const authEvents_1 = require("../events/authEvents");
const approvalNotificationQueue_1 = require("./approvalNotificationQueue");
const appConfig_1 = require("../config/appConfig");
const logger_1 = __importDefault(require("../utils/logger"));
const redisClient_1 = require("../infra/redis/redisClient");
let workerInstance = null;
function initEmployerApprovalWorker(redis) {
    if (workerInstance) {
        return workerInstance;
    }
    const connection = (0, redisClient_1.duplicateRedisConnection)(redis);
    workerInstance = new bullmq_1.Worker(employerApprovalQueue_1.EMPLOYER_APPROVAL_QUEUE_NAME, async (job) => {
        const prisma = (0, prismaClient_1.getPrismaClient)();
        const config = (0, appConfig_1.loadAppConfig)();
        const { userId, email, role } = job.data;
        logger_1.default.info({
            event: 'employer_approval_job_started',
            jobId: job.id,
            userId,
            email,
            role,
        });
        try {
            // Check if user exists and email is verified
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }
            if (!user.emailVerified) {
                logger_1.default.info({
                    event: 'employer_approval_skipped',
                    userId,
                    reason: 'email_not_verified',
                });
                return;
            }
            // Run domain validation rules
            const shouldAutoApprove = await checkAutoApprovalRules(user, config);
            if (shouldAutoApprove) {
                // Auto approve the employer
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        status: 'ACTIVE',
                        approvalStatus: 'APPROVED',
                        approvedAt: new Date(),
                        approvedBy: 'system',
                    },
                });
                // Queue notification email
                const notificationQueue = (0, approvalNotificationQueue_1.getApprovalNotificationQueue)();
                await notificationQueue.add('send_approved', {
                    userId,
                    email,
                    status: 'approved',
                    approvedBy: 'system',
                });
                // Publish approval event
                await (0, authEvents_1.publishEmployerApprovalEvent)({
                    userId,
                    email,
                    role: 'employer',
                    approvalStatus: 'approved',
                    approvedBy: 'system',
                    approvedAt: new Date().toISOString(),
                });
                logger_1.default.info({
                    event: 'employer_auto_approved',
                    userId,
                    email,
                });
            }
            else {
                // Mark as needing manual review
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        approvalStatus: 'PENDING',
                    },
                });
                // Queue notification email for manual review
                const notificationQueue = (0, approvalNotificationQueue_1.getApprovalNotificationQueue)();
                await notificationQueue.add('send_pending_review', {
                    userId,
                    email,
                    status: 'pending',
                    reason: 'Domain not in trusted list',
                });
                // Publish pending event
                await (0, authEvents_1.publishEmployerApprovalEvent)({
                    userId,
                    email,
                    role: 'employer',
                    approvalStatus: 'pending',
                    approvedBy: null,
                    approvedAt: new Date().toISOString(),
                });
                logger_1.default.info({
                    event: 'employer_needs_manual_approval',
                    userId,
                    email,
                });
            }
        }
        catch (error) {
            logger_1.default.error({
                event: 'employer_approval_job_failed',
                jobId: job.id,
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, { connection });
    workerInstance.on('failed', (job, error) => {
        logger_1.default.error({
            event: 'employer_approval_job_failed',
            jobId: job?.id,
            userId: job?.data?.userId,
            error: error instanceof Error ? error.message : String(error),
        });
    });
    workerInstance.on('error', (error) => {
        logger_1.default.error({
            event: 'employer_approval_worker_error',
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return workerInstance;
}
// Domain validation logic
async function checkAutoApprovalRules(user, config) {
    const email = user.email.toLowerCase();
    const emailDomain = email.split('@')[1];
    if (!emailDomain) {
        return false;
    }
    // Check against blocked domains
    if (config.employerApproval?.blockedDomains?.includes(emailDomain)) {
        return false;
    }
    // Check against trusted domains
    if (config.employerApproval?.trustedDomains?.includes(emailDomain)) {
        return true;
    }
    // Basic format validation - reject disposable email domains
    const disposableDomains = [
        '10minutemail.com',
        'tempmail.org',
        'guerrillamail.com',
        'mailinator.com',
        'throwaway.email',
    ];
    if (disposableDomains.includes(emailDomain)) {
        return false;
    }
    // Default: require manual review for unknown domains
    return false;
}
async function shutdownEmployerApprovalWorker() {
    if (!workerInstance) {
        return;
    }
    await workerInstance.close();
    workerInstance = null;
}
//# sourceMappingURL=employerApprovalWorker.js.map