import { PrismaClient } from '@prisma/client';
/**
 * Get or create Prisma client instance with connection pooling
 * Connection pool is automatically managed by Prisma
 */
export declare function getPrismaClient(): PrismaClient;
/**
 * Disconnect Prisma client and close all connections
 */
export declare function disconnectPrismaClient(): Promise<void>;
/**
 * Health check for database connection
 */
export declare function checkDatabaseConnection(): Promise<boolean>;
//# sourceMappingURL=prismaClient.d.ts.map