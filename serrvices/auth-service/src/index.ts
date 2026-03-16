import express from 'express';
import { validateEnv, printEnvSummary } from './config/envValidation';
import { bootstrapAppContext, shutdownAppContext } from './container/appContext';
import authRouter from './routes/auth.routes';
import { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } from './middlewares/requestLogger';
import { shutdownMiddleware, setupGracefulShutdown } from './utils/gracefulShutdown';

// Validate environment variables before starting
const env = validateEnv();
printEnvSummary(env);

bootstrapAppContext()
  .then(async () => {
    const app = express();

    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);

    app.use(express.json());
    app.use('/api/auth', authRouter);

    app.use(shutdownMiddleware);
    app.use(errorLoggerMiddleware);

    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    const server = app.listen(port, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`[Bootstrap] Auth login service listening on : ${port}`);
      }
    });

    setupGracefulShutdown(server, {
      timeout: 30000,
      onShutdownStart: async () => {
        console.info('[Shutdown] Stopping...');
      },
      onShutdownComplete: async () => {
        await shutdownAppContext();
        console.info('[Shutdown] All resources cleaned up');
      },
    });
  })
  .catch((error) => {
    console.error('[Bootstrap] Failed to initialise infrastructure', error);
    process.exitCode = 1;
  });
