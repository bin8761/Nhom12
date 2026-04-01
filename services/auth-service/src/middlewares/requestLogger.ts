import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

// Extend Express Request type to include id
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

/**
 * Middleware to generate and attach request ID to each request
 * Request ID can be provided by client via X-Request-ID header or auto-generated
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  
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
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { method, path, ip, headers } = req;
  
  // Log incoming request
  logger.info({
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
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    // Calculate duration
    const duration = Date.now() - req.startTime;
    const { statusCode } = res;
    
    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    // Log response
    logger[logLevel]({
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
export function errorLoggerMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { method, path } = req;
  const duration = Date.now() - req.startTime;
  
  logger.error({
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
export function logWithContext(req: Request, level: 'info' | 'warn' | 'error', message: string, meta?: object): void {
  logger[level]({
    requestId: req.id,
    ...meta,
  }, message);
}
