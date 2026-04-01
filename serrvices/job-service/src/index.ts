import express from 'express';
import cors from 'cors';
import { validateEnv, printEnvSummary } from './config/envValidation';
import { bootstrapAppContext, shutdownAppContext } from './container/appContext';
import publicJobsRouter from './routes/publicJobs.routes';
import publicLocationsRouter from './routes/publicLocations.routes';
import { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import { shutdownMiddleware, setupGracefulShutdown } from './utils/gracefulShutdown';

// Validate environment variables before starting
const env = validateEnv();
printEnvSummary(env);

bootstrapAppContext()
  .then(async () => {
    const app = express();

    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      maxAge: 86400,
    }));

    app.use(express.json());

    // Static assets for job images/documents if present
    app.use('/storage', express.static('storage'));
    app.use('/uploads', express.static('uploads'));

    app.use('/api/public/jobs', publicJobsRouter);
    app.use('/api/public/locations', publicLocationsRouter);

    app.use(shutdownMiddleware);
    app.use(errorLoggerMiddleware);
    app.use(errorHandler);

    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    const server = app.listen(port, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`[Bootstrap] Job search service listening on : ${port}`);
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
