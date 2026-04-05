import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

export const CLEANUP_QUEUE_NAME = 'maintenance.cleanup';

export interface CleanupJobPayload {
  task: 'purge-expired';
}

let cleanupQueue: Queue<CleanupJobPayload> | null = null;

export async function initCleanupQueue(redisConnection: Redis): Promise<Queue<CleanupJobPayload>> {
  if (cleanupQueue) {
    return cleanupQueue;
  }

  const queueConnection = duplicateRedisConnection(redisConnection);

  cleanupQueue = new Queue<CleanupJobPayload>(CLEANUP_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  await cleanupQueue.waitUntilReady();
  return cleanupQueue;
}

export function getCleanupQueue(): Queue<CleanupJobPayload> {
  if (!cleanupQueue) {
    throw new Error('Cleanup queue has not been initialised yet.');
  }
  return cleanupQueue;
}

export async function scheduleCleanupJobs(): Promise<void> {
  const queue = getCleanupQueue();
  // Run at minute 0 of every hour
  await queue.add(
    'purge-expired',
    { task: 'purge-expired' },
    { repeat: { pattern: '0 * * * *' }, jobId: 'purge-expired-hourly' },
  );
}

export async function shutdownCleanupQueue(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (cleanupQueue) {
    tasks.push(cleanupQueue.close());
    cleanupQueue = null;
  }
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}


