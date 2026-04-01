"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrismaClient = getPrismaClient;
exports.disconnectPrismaClient = disconnectPrismaClient;
exports.checkDatabaseConnection = checkDatabaseConnection;
const client_1 = require("@prisma/client");
let prisma = null;
/**
 * Get or create Prisma client instance with connection pooling
 * Connection pool is automatically managed by Prisma
 */
function getPrismaClient() {
    if (!prisma) {
        prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
            errorFormat: 'pretty',
        });
        // Log connection pool info on startup
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Prisma connection pool initialized');
            console.log('   Connection limit:', getConnectionLimit());
            console.log('   Pool timeout:', getPoolTimeout());
        }
        // Graceful shutdown
        process.on('beforeExit', async () => {
            await disconnectPrismaClient();
        });
    }
    return prisma;
}
/**
 * Disconnect Prisma client and close all connections
 */
async function disconnectPrismaClient() {
    if (!prisma) {
        return;
    }
    await prisma.$disconnect();
    prisma = null;
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 Prisma connection pool closed');
    }
}
/**
 * Get connection limit from DATABASE_URL
 */
function getConnectionLimit() {
    const url = process.env.DATABASE_URL || '';
    const match = url.match(/connection_limit=(\d+)/);
    return match ? parseInt(match[1]) : 10; // Default: 10
}
/**
 * Get pool timeout from DATABASE_URL
 */
function getPoolTimeout() {
    const url = process.env.DATABASE_URL || '';
    const match = url.match(/pool_timeout=(\d+)/);
    return match ? parseInt(match[1]) : 30; // Default: 30s
}
/**
 * Health check for database connection
 */
async function checkDatabaseConnection() {
    try {
        const client = getPrismaClient();
        await client.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('Database connection check failed:', error);
        return false;
    }
}
//# sourceMappingURL=prismaClient.js.map