"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPLOYER_APPROVAL_QUEUE_NAME = void 0;
exports.initEmployerApprovalQueue = initEmployerApprovalQueue;
exports.getEmployerApprovalQueue = getEmployerApprovalQueue;
exports.shutdownEmployerApprovalQueue = shutdownEmployerApprovalQueue;
const bullmq_1 = require("bullmq");
const redisClient_1 = require("../infra/redis/redisClient");
exports.EMPLOYER_APPROVAL_QUEUE_NAME = 'employer.approval';
const DEFAULT_BACKOFF_DELAY_MS = 2000;
let employerApprovalQueue = null;
async function initEmployerApprovalQueue(redisConnection) {
    if (employerApprovalQueue) {
        return employerApprovalQueue;
    }
    const queueConnection = (0, redisClient_1.duplicateRedisConnection)(redisConnection);
    employerApprovalQueue = new bullmq_1.Queue(exports.EMPLOYER_APPROVAL_QUEUE_NAME, {
        connection: queueConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
    await employerApprovalQueue.waitUntilReady();
    return employerApprovalQueue;
}
function getEmployerApprovalQueue() {
    if (!employerApprovalQueue) {
        throw new Error('Employer approval queue has not been initialised yet.');
    }
    return employerApprovalQueue;
}
async function shutdownEmployerApprovalQueue() {
    const tasks = [];
    if (employerApprovalQueue) {
        tasks.push(employerApprovalQueue.close());
        employerApprovalQueue = null;
    }
    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
    }
}
//# sourceMappingURL=employerApprovalQueue.js.map