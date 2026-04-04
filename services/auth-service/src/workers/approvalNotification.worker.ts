// Suppress Redis version warnings
const suppressRedisVersionWarnings = (originalMethod: typeof console.warn) => {
  return (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('highly recommended to use a minimum Redis version') ||
        message.includes('Current:') ||
        message.includes('Redis version'))
    ) {
      return; // Suppress Redis version warnings
    }
    originalMethod.apply(console, args);
  };
};

const originalWarn = console.warn;
const originalLog = console.log;
console.warn = suppressRedisVersionWarnings(originalWarn);
console.log = suppressRedisVersionWarnings(originalLog);

import { bootstrapAppContext } from '../container/appContext';
import { initApprovalNotificationWorker } from '../jobs/approvalNotificationWorker';

bootstrapAppContext()
  .then((context) => {
    initApprovalNotificationWorker(context.redis);
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Approval Notification Worker] approval.notification worker started');
    }
  })
  .catch((error) => {
    console.error('[Approval Notification Worker] Failed to start approval notification worker', error);
    process.exit(1);
  });


