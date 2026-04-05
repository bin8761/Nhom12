import { Request, Response, NextFunction } from 'express';
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
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to log incoming requests and responses
 * Logs request details, response status, and duration
 */
export declare function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to log errors with request context
 */
export declare function errorLoggerMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void;
/**
 * Helper function to log with request context in controllers/services
 */
export declare function logWithContext(req: Request, level: 'info' | 'warn' | 'error', message: string, meta?: object): void;
//# sourceMappingURL=requestLogger.d.ts.map