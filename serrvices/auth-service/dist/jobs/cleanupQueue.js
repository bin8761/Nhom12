"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLEANUP_QUEUE_NAME = void 0;
exports.initCleanupQueue = initCleanupQueue;
exports.getCleanupQueue = getCleanupQueue;
exports.scheduleCleanupJobs = scheduleCleanupJobs;
exports.shutdownCleanupQueue = shutdownCleanupQueue;
const bullmq_1 = require("bullmq");
const redisClient_1 = require("../infra/redis/redisClient");
exports.CLEANUP_QUEUE_NAME = 'maintenance.cleanup';
let cleanupQueue = null;
async function initCleanupQueue(redisConnection) {
    if (cleanupQueue) {
        return cleanupQueue;
    }
    const queueConnection = (0, redisClient_1.duplicateRedisConnection)(redisConnection);
    cleanupQueue = new bullmq_1.Queue(exports.CLEANUP_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    await cleanupQueue.waitUntilReady();
    return cleanupQueue;
}
function getCleanupQueue() {
    if (!cleanupQueue) {
        throw new Error('Cleanup queue has not been initialised yet.');
    }
    return cleanupQueue;
}
async function scheduleCleanupJobs() {
    const queue = getCleanupQueue();
    // Run at minute 0 of every hour
    await queue.add('purge-expired', { task: 'purge-expired' }, { repeat: { pattern: '0 * * * *' }, jobId: 'purge-expired-hourly' });
}
async function shutdownCleanupQueue() {
    const tasks = [];
    if (cleanupQueue) {
        tasks.push(cleanupQueue.close());
        cleanupQueue = null;
    }
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}
//# sourceMappingURL=cleanupQueue.js.map