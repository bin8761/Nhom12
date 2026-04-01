import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { CLEANUP_QUEUE_NAME, type CleanupJobPayload } from './cleanupQueue';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { loadAppConfig } from '../config/appConfig';
import logger from '../utils/logger';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

let workerInstance: Worker<CleanupJobPayload> | null = null;

export function initCleanupWorker(redis: Redis): Worker<CleanupJobPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = duplicateRedisConnection(redis);
  workerInstance = new Worker<CleanupJobPayload>(
    CLEANUP_QUEUE_NAME,
    async () => {
      const prisma = getPrismaClient();
      const config = loadAppConfig();
      const now = new Date();
      const threshold = new Date(now.getTime() - config.emailVerification.maxPendingAgeHours * 60 * 60 * 1000);

      // Clean up expired tokens
      const [refresh, verif] = await Promise.allSettled([
        prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);

      // For stale users, just mark as suspended instead of deleting
      // This prevents foreign key constraint errors
      const staleUsersUpdated = await prisma.user.updateMany({
        where: { emailVerified: false, status: 'PENDING', createdAt: { lt: threshold } },
        data: { status: 'SUSPENDED' },
      });

      logger.info({
        event: 'cleanup_purge_expired',
        refreshTokensPurged:
          refresh.status === 'fulfilled' ? refresh.value.count : undefined,
        emailVerificationsPurged:
          verif.status === 'fulfilled' ? verif.value.count : undefined,
        pendingUsersPurged: staleUsersUpdated.count,
      });
    },
    { connection },
  );

  workerInstance.on('failed', (job, error) => {
    logger.error({
      event: 'cleanup_job_failed',
      jobId: job?.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return workerInstance;
}

export async function shutdownCleanupWorker(): Promise<void> {
  if (!workerInstance) return;
  await workerInstance.close();
  workerInstance = null;
}


