"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isServiceShuttingDown = isServiceShuttingDown;
exports.setupGracefulShutdown = setupGracefulShutdown;
exports.shutdownMiddleware = shutdownMiddleware;
const prismaClient_1 = require("../infra/prisma/prismaClient");
const redisClient_1 = require("../infra/redis/redisClient");
const natsClient_1 = require("../infra/nats/natsClient");
const logger_1 = __importDefault(require("./logger"));
let isShuttingDown = false;
let shutdownTimeout = null;
/**
 * Check if service is shutting down
 */
function isServiceShuttingDown() {
    return isShuttingDown;
}
/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server, options = {}) {
    const { timeout = 30000, // 30 seconds
    onShutdownStart, onShutdownComplete } = options;
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
        logger_1.default.error({ error }, 'Uncaught exception, shutting down');
        await handleShutdown(server, timeout, 'UNCAUGHT_EXCEPTION', onShutdownStart, onShutdownComplete);
    });
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
        logger_1.default.error({ reason }, 'Unhandled rejection, shutting down');
        await handleShutdown(server, timeout, 'UNHANDLED_REJECTION', onShutdownStart, onShutdownComplete);
    });
    logger_1.default.info('Graceful shutdown handlers registered');
}
/**
 * Handle shutdown process
 */
async function handleShutdown(server, timeout, signal, onShutdownStart, onShutdownComplete) {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
        logger_1.default.warn('Shutdown already in progress, ignoring signal');
        return;
    }
    isShuttingDown = true;
    logger_1.default.info({ signal }, 'Shutdown signal received, starting graceful shutdown...');
    // Call custom shutdown start handler
    if (onShutdownStart) {
        try {
            await onShutdownStart();
        }
        catch (error) {
            logger_1.default.error({ error }, 'Error in shutdown start handler');
        }
    }
    // Set timeout to force shutdown if graceful shutdown takes too long
    shutdownTimeout = setTimeout(() => {
        logger_1.default.error({ timeout }, 'Graceful shutdown timeout reached, forcing exit');
        process.exit(1);
    }, timeout);
    try {
        // Step 1: Stop accepting new connections
        logger_1.default.info('📡 Closing HTTP server (stop accepting new requests)...');
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    logger_1.default.error({ error: err }, 'Error closing HTTP server');
                    reject(err);
                }
                else {
                    logger_1.default.info('✅ HTTP server closed');
                    resolve();
                }
            });
        });
        // Step 2: Close database connections
        logger_1.default.info('💾 Closing database connections...');
        await (0, prismaClient_1.disconnectPrismaClient)();
        logger_1.default.info('✅ Database connections closed');
        // Step 3: Close Redis connections
        logger_1.default.info('🔴 Closing Redis connections...');
        try {
            const redis = (0, redisClient_1.getRedisClient)();
            await redis.quit();
            logger_1.default.info('✅ Redis connections closed');
        }
        catch (error) {
            logger_1.default.warn({ error }, 'Error closing Redis connections');
        }
        // Step 4: Close NATS connections
        logger_1.default.info('📨 Closing NATS connections...');
        try {
            await (0, natsClient_1.closeNatsConnection)();
            logger_1.default.info('✅ NATS connections closed');
        }
        catch (error) {
            logger_1.default.warn({ error }, 'Error closing NATS connections');
        }
        // Call custom shutdown complete handler
        if (onShutdownComplete) {
            try {
                await onShutdownComplete();
            }
            catch (error) {
                logger_1.default.error({ error }, 'Error in shutdown complete handler');
            }
        }
        // Clear timeout
        if (shutdownTimeout) {
            clearTimeout(shutdownTimeout);
        }
        logger_1.default.info('Graceful shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
    }
}
/**
 * Middleware to reject requests during shutdown
 */
function shutdownMiddleware(req, res, next) {
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
//# sourceMappingURL=gracefulShutdown.js.map