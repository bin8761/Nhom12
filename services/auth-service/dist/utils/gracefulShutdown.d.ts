import { Server } from 'http';
/**
 * Check if service is shutting down
 */
export declare function isServiceShuttingDown(): boolean;
/**
 * Setup graceful shutdown handlers
 */
export declare function setupGracefulShutdown(server: Server, options?: {
    timeout?: number;
    onShutdownStart?: () => void | Promise<void>;
    onShutdownComplete?: () => void | Promise<void>;
}): void;
/**
 * Middleware to reject requests during shutdown
 */
export declare function shutdownMiddleware(req: any, res: any, next: any): void;
//# sourceMappingURL=gracefulShutdown.d.ts.map