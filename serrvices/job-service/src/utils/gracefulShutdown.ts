import { Server } from 'http';
import { disconnectPrismaClient } from '../infra/prisma/prismaClient';
import { getRedisClient } from '../infra/redis/redisClient';
import { getNatsConnectionOrNull } from '../infra/nats/natsClient';
import logger from './logger';

let isShuttingDown = false;
let shutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Check if service is shutting down
 */
export function isServiceShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(server: Server, options: {
  timeout?: number; // Timeout in milliseconds (default: 30s)
  onShutdownStart?: () => void | Promise<void>;
  onShutdownComplete?: () => void | Promise<void>;
} = {}): void {
  const { 
    timeout = 30000, // 30 seconds
    onShutdownStart,
    onShutdownComplete 
  } = options;

  // Handle SIGTERM (graceful shutdown signal)
  process.on('SIGTERM', async () => {
    await handleShutdown(server, timeout, 'SIGTERM', onShutdownStart, onShutdownComplete);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    await handleShutdown(server, timeout, 'SIGINT', onShutdownStart, onShutdownComplete);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error({ error }, 'Uncaught exception, shutting down');
    await handleShutdown(server, timeout, 'UNCAUGHT_EXCEPTION', onShutdownStart, onShutdownComplete);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    logger.error({ reason }, 'Unhandled rejection, shutting down');
    await handleShutdown(server, timeout, 'UNHANDLED_REJECTION', onShutdownStart, onShutdownComplete);
  });

  logger.info('Graceful shutdown handlers registered');
}

/**
 * Handle shutdown process
 */
async function handleShutdown(
  server: Server,
  timeout: number,
  signal: string,
  onShutdownStart?: () => void | Promise<void>,
  onShutdownComplete?: () => void | Promise<void>
): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown...');

  // Call custom shutdown start handler
  if (onShutdownStart) {
    try {
      await onShutdownStart();
    } catch (error) {
      logger.error({ error }, 'Error in shutdown start handler');
    }
  }

  // Set timeout to force shutdown if graceful shutdown takes too long
  shutdownTimeout = setTimeout(() => {
    logger.error({ timeout }, 'Graceful shutdown timeout reached, forcing exit');
    process.exit(1);
  }, timeout);

  try {
    // Step 1: Stop accepting new connections
    logger.info('Closing HTTP server (stop accepting new requests)...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error({ error: err }, 'Error closing HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Step 2: Close database connections
    logger.info('Closing database connections...');
    await disconnectPrismaClient();
    logger.info('Database connections closed');

    // Step 3: Close Redis connections
    logger.info('Closing Redis connections...');
    try {
      const redis = getRedisClient();
      await redis.quit();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.warn({ error }, 'Error closing Redis connections');
    }

    // Step 4: Close NATS connections
    logger.info('Closing NATS connections...');
    try {
      const nats = getNatsConnectionOrNull();
      if (nats) {
        await nats.close();
        logger.info('NATS connections closed');
      }
    } catch (error) {
      logger.warn({ error }, 'Error closing NATS connections');
    }

    // Call custom shutdown complete handler
    if (onShutdownComplete) {
      try {
        await onShutdownComplete();
      } catch (error) {
        logger.error({ error }, 'Error in shutdown complete handler');
      }
    }

    // Clear timeout
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Middleware to reject requests during shutdown
 */
export function shutdownMiddleware(req: any, res: any, next: any): void {
  if (isShuttingDown) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Service is shutting down, please try again later',
      code: 'ERR_SERVICE_SHUTTING_DOWN',
    });
    return;
  }
  next();
}
