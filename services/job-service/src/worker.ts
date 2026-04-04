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

import { bootstrapAppContext } from './container/appContext';
import { initJobApprovalWorker, shutdownJobApprovalWorker } from './jobs/jobApprovalWorker';

async function main() {
  const appContext = await bootstrapAppContext();
  initJobApprovalWorker(appContext.redisClients.bullQueue);
  if (process.env.NODE_ENV !== 'test') {
    console.info('[Worker] Job approval worker running');
  }

  const shutdown = async () => {
    if (process.env.NODE_ENV !== 'test') {
      console.info('[Worker] Shutting down…');
    }
    await shutdownJobApprovalWorker();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Worker] Failed to initialise worker', error);
  process.exit(1);
});
