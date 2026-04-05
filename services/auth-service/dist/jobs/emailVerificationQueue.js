"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_VERIFICATION_QUEUE_NAME = void 0;
exports.initEmailVerificationQueue = initEmailVerificationQueue;
exports.getEmailVerificationQueue = getEmailVerificationQueue;
exports.shutdownEmailVerificationQueue = shutdownEmailVerificationQueue;
const bullmq_1 = require("bullmq");
const redisClient_1 = require("../infra/redis/redisClient");
exports.EMAIL_VERIFICATION_QUEUE_NAME = 'email.verification';
const DEFAULT_BACKOFF_DELAY_MS = 1000;
let emailVerificationQueue = null;
async function initEmailVerificationQueue(redisConnection) {
    if (emailVerificationQueue) {
        return emailVerificationQueue;
    }
    const queueConnection = (0, redisClient_1.duplicateRedisConnection)(redisConnection);
    emailVerificationQueue = new bullmq_1.Queue(exports.EMAIL_VERIFICATION_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    await emailVerificationQueue.waitUntilReady();
    return emailVerificationQueue;
}
function getEmailVerificationQueue() {
    if (!emailVerificationQueue) {
        throw new Error('Email verification queue has not been initialised yet.');
    }
    return emailVerificationQueue;
}
async function shutdownEmailVerificationQueue() {
    const tasks = [];
    if (emailVerificationQueue) {
        tasks.push(emailVerificationQueue.close());
        emailVerificationQueue = null;
    }
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}
//# sourceMappingURL=emailVerificationQueue.js.map