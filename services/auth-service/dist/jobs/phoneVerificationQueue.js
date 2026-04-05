"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHONE_VERIFICATION_QUEUE_NAME = void 0;
exports.initPhoneVerificationQueue = initPhoneVerificationQueue;
exports.getPhoneVerificationQueue = getPhoneVerificationQueue;
exports.shutdownPhoneVerificationQueue = shutdownPhoneVerificationQueue;
const bullmq_1 = require("bullmq");
const redisClient_1 = require("../infra/redis/redisClient");
exports.PHONE_VERIFICATION_QUEUE_NAME = 'phone.verification';
const DEFAULT_BACKOFF_DELAY_MS = 2000;
let phoneVerificationQueue = null;
async function initPhoneVerificationQueue(redisConnection) {
    if (phoneVerificationQueue) {
        return phoneVerificationQueue;
    }
    const queueConnection = (0, redisClient_1.duplicateRedisConnection)(redisConnection);
    phoneVerificationQueue = new bullmq_1.Queue(exports.PHONE_VERIFICATION_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    await phoneVerificationQueue.waitUntilReady();
    return phoneVerificationQueue;
}
function getPhoneVerificationQueue() {
    if (!phoneVerificationQueue) {
        throw new Error('Phone verification queue has not been initialised yet.');
    }
    return phoneVerificationQueue;
}
async function shutdownPhoneVerificationQueue() {
    const tasks = [];
    if (phoneVerificationQueue) {
        tasks.push(phoneVerificationQueue.close());
        phoneVerificationQueue = null;
    }
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}
//# sourceMappingURL=phoneVerificationQueue.js.map