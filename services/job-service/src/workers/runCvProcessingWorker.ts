import { validateEnv } from '../config/envValidation';
import { bootstrapAppContext, shutdownAppContext } from '../container/appContext';
import { initCvProcessingWorker, shutdownCvProcessingWorker } from './cvProcessingWorker';

validateEnv();

bootstrapAppContext()
  .then(async (context) => {
    await initCvProcessingWorker(context.redisClients.bullQueue);
    console.info('[Worker] CV processing worker started');

    const shutdown = async () => {
      console.info('[Worker] Shutting down CV processing worker');
      await shutdownCvProcessingWorker();
      await shutdownAppContext();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error('[Worker] Failed to bootstrap CV processing worker', error);
    process.exit(1);
  });
