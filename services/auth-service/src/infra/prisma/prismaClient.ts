import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client instance with connection pooling
 * Connection pool is automatically managed by Prisma
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
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
export async function disconnectPrismaClient(): Promise<void> {
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
function getConnectionLimit(): number {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/connection_limit=(\d+)/);
  return match ? parseInt(match[1]) : 10; // Default: 10
}

/**
 * Get pool timeout from DATABASE_URL
 */
function getPoolTimeout(): number {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/pool_timeout=(\d+)/);
  return match ? parseInt(match[1]) : 30; // Default: 30s
}

/**
 * Health check for database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}
