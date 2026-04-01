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
const emailVerificationWorker_1 = require("../jobs/emailVerificationWorker");
(0, appContext_1.bootstrapAppContext)()
    .then((context) => {
    (0, emailVerificationWorker_1.initEmailVerificationWorker)(context.redis);
    if (process.env.NODE_ENV !== 'test') {
        console.info('[Email Worker] email.verification worker started');
    }
})
    .catch((error) => {
    console.error('[Email Worker] Failed to start email verification worker', error);
    process.exit(1);
});
//# sourceMappingURL=emailVerification.worker.js.map