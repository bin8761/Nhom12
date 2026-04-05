"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPROVAL_NOTIFICATION_QUEUE_NAME = void 0;
exports.initApprovalNotificationQueue = initApprovalNotificationQueue;
exports.getApprovalNotificationQueue = getApprovalNotificationQueue;
exports.shutdownApprovalNotificationQueue = shutdownApprovalNotificationQueue;
const bullmq_1 = require("bullmq");
const redisClient_1 = require("../infra/redis/redisClient");
exports.APPROVAL_NOTIFICATION_QUEUE_NAME = 'approval.notification';
const DEFAULT_BACKOFF_DELAY_MS = 2000;
let approvalNotificationQueue = null;
async function initApprovalNotificationQueue(redisConnection) {
    if (approvalNotificationQueue) {
        return approvalNotificationQueue;
    }
    const queueConnection = (0, redisClient_1.duplicateRedisConnection)(redisConnection);
    approvalNotificationQueue = new bullmq_1.Queue(exports.APPROVAL_NOTIFICATION_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    await approvalNotificationQueue.waitUntilReady();
    return approvalNotificationQueue;
}
function getApprovalNotificationQueue() {
    if (!approvalNotificationQueue) {
        throw new Error('Approval notification queue has not been initialised yet.');
    }
    return approvalNotificationQueue;
}
async function shutdownApprovalNotificationQueue() {
    const tasks = [];
    if (approvalNotificationQueue) {
        tasks.push(approvalNotificationQueue.close());
        approvalNotificationQueue = null;
    }
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}
//# sourceMappingURL=approvalNotificationQueue.js.map