"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Suppress Redis version warnings
const suppressRedisVersionWarnings = (originalMethod) => {
    return (...args) => {
        const message = args[0];
        if (typeof message === 'string' &&
            (message.includes('highly recommended to use a minimum Redis version') ||
                message.includes('Current:') ||
                message.includes('Redis version'))) {
            return; // Suppress Redis version warnings
        }
        originalMethod.apply(console, args);
    };
};
const originalWarn = console.warn;
const originalLog = console.log;
console.warn = suppressRedisVersionWarnings(originalWarn);
console.log = suppressRedisVersionWarnings(originalLog);
const appContext_1 = require("../container/appContext");
const approvalNotificationWorker_1 = require("../jobs/approvalNotificationWorker");
(0, appContext_1.bootstrapAppContext)()
    .then((context) => {
    (0, approvalNotificationWorker_1.initApprovalNotificationWorker)(context.redis);
    if (process.env.NODE_ENV !== 'test') {
        console.info('[Approval Notification Worker] approval.notification worker started');
    }
})
    .catch((error) => {
    console.error('[Approval Notification Worker] Failed to start approval notification worker', error);
    process.exit(1);
});
//# sourceMappingURL=approvalNotification.worker.js.map