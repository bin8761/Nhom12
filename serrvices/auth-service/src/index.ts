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

import express from 'express';
import cors from 'cors';
import { validateEnv, printEnvSummary } from './config/envValidation';
import { bootstrapAppContext } from './container/appContext';
import { initEmailVerificationWorker } from './jobs/emailVerificationWorker';
import { scheduleCleanupJobs } from './jobs/cleanupQueue';
import { initCleanupWorker } from './jobs/cleanupWorker';
import { initEmployerApprovalWorker } from './jobs/employerApprovalWorker';
import { initApprovalNotificationWorker } from './jobs/approvalNotificationWorker';
import { initPhoneVerificationWorker } from './jobs/phoneVerificationWorker';
import authRouter from './routes/auth.routes';
import { initNatsConnection, closeNatsConnection } from './infra/nats/natsClient';

// Validate environment variables before starting
const env = validateEnv();
printEnvSummary(env);

import { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } from './middlewares/requestLogger';
import { shutdownMiddleware, setupGracefulShutdown } from './utils/gracefulShutdown';

bootstrapAppContext()
  .then(async (context) => {
    try {
      await initNatsConnection({ servers: context.config.eventBus.url });
      console.info('[Bootstrap] Connected to NATS');
    } catch (error) {
      console.error('[Bootstrap] Failed to connect to NATS', error);
      throw error;
    }

    initEmailVerificationWorker(context.redis);
    initCleanupWorker(context.redis);
    initEmployerApprovalWorker(context.redis);
    initApprovalNotificationWorker(context.redis);
    initPhoneVerificationWorker(context.redis);
    scheduleCleanupJobs().catch((e) => {
      console.error('[Bootstrap] Failed to schedule cleanup jobs', e);
    });

    const app = express();
    
    // Request ID and logging middleware (before other middlewares)
    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);
    
    // CORS configuration
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
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
      maxAge: 86400, // 24 hours
    }));

    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Shutdown middleware (reject requests during shutdown)
    app.use(shutdownMiddleware);

    // Error logging middleware (after routes)
    app.use(errorLoggerMiddleware);

    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    const server = app.listen(port, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`[Bootstrap] Auth service listening on : ${port}`);
      }
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server, {
      timeout: 30000, // 30 seconds
      onShutdownStart: async () => {
        console.info('[Shutdown] Stopping workers...');
        // Workers will stop accepting new jobs
      },
      onShutdownComplete: async () => {
        console.info('[Shutdown] All resources cleaned up');
      },
    });
  })
  .catch((error) => {
    console.error('[Bootstrap] Failed to initialise infrastructure', error);
    void closeNatsConnection();
    process.exitCode = 1;
  });


