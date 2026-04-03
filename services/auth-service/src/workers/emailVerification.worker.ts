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
import { initEmailVerificationWorker } from '../jobs/emailVerificationWorker';

bootstrapAppContext()
  .then((context) => {
    initEmailVerificationWorker(context.redis);
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Email Worker] email.verification worker started');
    }
  })
  .catch((error) => {
    console.error('[Email Worker] Failed to start email verification worker', error);
    process.exit(1);
  });


