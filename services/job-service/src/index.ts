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
import healthRouter from './routes/health.routes';
import employerJobsRouter from './routes/employerJobs.routes';
import publicJobsRouter from './routes/publicJobs.routes';
import publicLocationsRouter from './routes/publicLocations.routes';
import { requestIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import { shutdownMiddleware, setupGracefulShutdown } from './utils/gracefulShutdown';

// Validate environment variables before starting
const env = validateEnv();
printEnvSummary(env);

bootstrapAppContext()
  .then(async (context) => {
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
    
    // Serve static files (images and documents)
    app.use('/storage', express.static('storage'));
    app.use('/uploads', express.static('uploads'));
    
    app.use('/api/jobs', employerJobsRouter);
    app.use('/api/public/jobs', publicJobsRouter);
    app.use('/api/public/locations', publicLocationsRouter);
    app.use('/', healthRouter);
    
    // Shutdown middleware (reject requests during shutdown)
    app.use(shutdownMiddleware);
    
    // Error handlers (must be last)
    app.use(errorLoggerMiddleware);
    app.use(errorHandler);

    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    const server = app.listen(port, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`[Bootstrap] Job service listening on : ${port}`);
        if (context.eventBus) {
          console.info('[Bootstrap] Connected to NATS');
        } else {
          console.warn('[Bootstrap] NATS connection not available');
        }
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
    process.exitCode = 1;
  });
