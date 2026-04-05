"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCleanupWorker = initCleanupWorker;
exports.shutdownCleanupWorker = shutdownCleanupWorker;
const bullmq_1 = require("bullmq");
const cleanupQueue_1 = require("./cleanupQueue");
const prismaClient_1 = require("../infra/prisma/prismaClient");
const appConfig_1 = require("../config/appConfig");
const logger_1 = __importDefault(require("../utils/logger"));
const redisClient_1 = require("../infra/redis/redisClient");
let workerInstance = null;
function initCleanupWorker(redis) {
    if (workerInstance) {
        return workerInstance;
    }
    const connection = (0, redisClient_1.duplicateRedisConnection)(redis);
    workerInstance = new bullmq_1.Worker(cleanupQueue_1.CLEANUP_QUEUE_NAME, async () => {
        const prisma = (0, prismaClient_1.getPrismaClient)();
        const config = (0, appConfig_1.loadAppConfig)();
        const now = new Date();
        const threshold = new Date(now.getTime() - config.emailVerification.maxPendingAgeHours * 60 * 60 * 1000);
        // Clean up expired tokens
        const [refresh, verif] = await Promise.allSettled([
            prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
            prisma.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } }),
        ]);
        // For stale users, just mark as suspended instead of deleting
        // This prevents foreign key constraint errors
        const staleUsersUpdated = await prisma.user.updateMany({
            where: { emailVerified: false, status: 'PENDING', createdAt: { lt: threshold } },
            data: { status: 'SUSPENDED' },
        });
        logger_1.default.info({
            event: 'cleanup_purge_expired',
            refreshTokensPurged: refresh.status === 'fulfilled' ? refresh.value.count : undefined,
            emailVerificationsPurged: verif.status === 'fulfilled' ? verif.value.count : undefined,
            pendingUsersPurged: staleUsersUpdated.count,
        });
    }, { connection });
    workerInstance.on('failed', (job, error) => {
        logger_1.default.error({
            event: 'cleanup_job_failed',
            jobId: job?.id,
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return workerInstance;
}
async function shutdownCleanupWorker() {
    if (!workerInstance)
        return;
    await workerInstance.close();
    workerInstance = null;
}
//# sourceMappingURL=cleanupWorker.js.map