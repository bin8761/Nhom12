"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapAppContext = bootstrapAppContext;
exports.getRedisConnection = getRedisConnection;
exports.getEmailVerificationQueueContext = getEmailVerificationQueueContext;
exports.getCleanupQueueContext = getCleanupQueueContext;
exports.getEmployerApprovalQueueContext = getEmployerApprovalQueueContext;
exports.getApprovalNotificationQueueContext = getApprovalNotificationQueueContext;
exports.getPhoneVerificationQueueContext = getPhoneVerificationQueueContext;
exports.shutdownAppContext = shutdownAppContext;
const appConfig_1 = require("../config/appConfig");
const redisClient_1 = require("../infra/redis/redisClient");
const emailVerificationQueue_1 = require("../jobs/emailVerificationQueue");
const cleanupQueue_1 = require("../jobs/cleanupQueue");
const employerApprovalQueue_1 = require("../jobs/employerApprovalQueue");
const approvalNotificationQueue_1 = require("../jobs/approvalNotificationQueue");
const phoneVerificationQueue_1 = require("../jobs/phoneVerificationQueue");
const emailVerificationWorker_1 = require("../jobs/emailVerificationWorker");
const phoneVerificationWorker_1 = require("../jobs/phoneVerificationWorker");
const natsClient_1 = require("../infra/nats/natsClient");
let contextPromise = null;
async function bootstrapAppContext() {
    if (!contextPromise) {
        contextPromise = (async () => {
            const config = (0, appConfig_1.loadAppConfig)();
            const redis = await (0, redisClient_1.initRedisClient)();
            const emailVerificationQueue = await (0, emailVerificationQueue_1.initEmailVerificationQueue)(redis);
            const cleanupQueue = await (0, cleanupQueue_1.initCleanupQueue)(redis);
            const employerApprovalQueue = await (0, employerApprovalQueue_1.initEmployerApprovalQueue)(redis);
            const approvalNotificationQueue = await (0, approvalNotificationQueue_1.initApprovalNotificationQueue)(redis);
            const phoneVerificationQueue = await (0, phoneVerificationQueue_1.initPhoneVerificationQueue)(redis);
            return {
                config,
                redis,
                queues: {
                    emailVerification: emailVerificationQueue,
                    cleanup: cleanupQueue,
                    employerApproval: employerApprovalQueue,
                    approvalNotification: approvalNotificationQueue,
                    phoneVerification: phoneVerificationQueue,
                },
            };
        })();
    }
    return contextPromise;
}
function getRedisConnection() {
    return (0, redisClient_1.getRedisClient)();
}
function getEmailVerificationQueueContext() {
    return (0, emailVerificationQueue_1.getEmailVerificationQueue)();
}
function getCleanupQueueContext() {
    return (0, cleanupQueue_1.getCleanupQueue)();
}
function getEmployerApprovalQueueContext() {
    return (0, employerApprovalQueue_1.getEmployerApprovalQueue)();
}
function getApprovalNotificationQueueContext() {
    return (0, approvalNotificationQueue_1.getApprovalNotificationQueue)();
}
function getPhoneVerificationQueueContext() {
    return (0, phoneVerificationQueue_1.getPhoneVerificationQueue)();
}
async function shutdownAppContext() {
    contextPromise = null;
    await (0, emailVerificationWorker_1.shutdownEmailVerificationWorker)();
    await (0, phoneVerificationWorker_1.shutdownPhoneVerificationWorker)();
    await Promise.allSettled([
        (0, emailVerificationQueue_1.shutdownEmailVerificationQueue)(),
        (0, cleanupQueue_1.shutdownCleanupQueue)(),
        (0, employerApprovalQueue_1.shutdownEmployerApprovalQueue)(),
        (0, approvalNotificationQueue_1.shutdownApprovalNotificationQueue)(),
        (0, phoneVerificationQueue_1.shutdownPhoneVerificationQueue)(),
        (0, redisClient_1.shutdownRedisClient)(),
        (0, natsClient_1.closeNatsConnection)(),
    ]);
}
//# sourceMappingURL=appContext.js.map