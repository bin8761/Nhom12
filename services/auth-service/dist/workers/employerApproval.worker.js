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
const employerApprovalWorker_1 = require("../jobs/employerApprovalWorker");
(0, appContext_1.bootstrapAppContext)()
    .then((context) => {
    (0, employerApprovalWorker_1.initEmployerApprovalWorker)(context.redis);
    if (process.env.NODE_ENV !== 'test') {
        console.info('[Employer Worker] employer.approval worker started');
    }
})
    .catch((error) => {
    console.error('[Employer Worker] Failed to start employer approval worker', error);
    process.exit(1);
});
//# sourceMappingURL=employerApproval.worker.js.map