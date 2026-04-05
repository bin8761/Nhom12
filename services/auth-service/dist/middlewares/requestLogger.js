"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
exports.requestLoggerMiddleware = requestLoggerMiddleware;
exports.errorLoggerMiddleware = errorLoggerMiddleware;
exports.logWithContext = logWithContext;
const crypto_1 = require("crypto");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Middleware to generate and attach request ID to each request
 * Request ID can be provided by client via X-Request-ID header or auto-generated
 */
function requestIdMiddleware(req, res, next) {
    // Get request ID from header or generate new one
    const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
    // Attach to request object
    req.id = requestId;
    req.startTime = Date.now();
    // Add to response headers so client can track
    res.setHeader('X-Request-ID', requestId);
    next();
}
/**
 * Middleware to log incoming requests and responses
 * Logs request details, response status, and duration
 */
function requestLoggerMiddleware(req, res, next) {
    const { method, path, ip, headers } = req;
    // Log incoming request
    logger_1.default.info({
        requestId: req.id,
        type: 'request',
        method,
        path,
        ip: ip || req.socket.remoteAddress,
        userAgent: headers['user-agent'],
        contentType: headers['content-type'],
    }, `>> ${method} ${path}`);
    // Capture original end function
    const originalEnd = res.end;
    // Override end function to log response
    res.end = function (chunk, encoding, callback) {
        // Calculate duration
        const duration = Date.now() - req.startTime;
        const { statusCode } = res;
        // Determine log level based on status code
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        // Log response
        logger_1.default[logLevel]({
            requestId: req.id,
            type: 'response',
            method,
            path,
            statusCode,
            duration,
            contentLength: res.getHeader('content-length'),
        }, `<< ${method} ${path} ${statusCode} (${duration}ms)`);
        // Call original end function
        return originalEnd.call(this, chunk, encoding, callback);
    };
    next();
}
/**
 * Middleware to log errors with request context
 */
function errorLoggerMiddleware(error, req, res, next) {
    const { method, path } = req;
    const duration = Date.now() - req.startTime;
    logger_1.default.error({
        requestId: req.id,
        type: 'error',
        method,
        path,
        duration,
        error: {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
    }, `XX ${method} ${path} - ${error.message}`);
    // Pass to next error handler
    next(error);
}
/**
 * Helper function to log with request context in controllers/services
 */
function logWithContext(req, level, message, meta) {
    logger_1.default[level]({
        requestId: req.id,
        ...meta,
    }, message);
}
//# sourceMappingURL=requestLogger.js.map