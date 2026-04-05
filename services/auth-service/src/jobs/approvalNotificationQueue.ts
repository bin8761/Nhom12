import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

export const APPROVAL_NOTIFICATION_QUEUE_NAME = 'approval.notification';

const DEFAULT_BACKOFF_DELAY_MS = 2_000;

export interface ApprovalNotificationJobPayload {
  userId: string;
  email: string;
  status: 'approved' | 'rejected' | 'pending';
  approvedBy?: string;
  reason?: string;
  note?: string;
  rejectedBy?: string;
}

let approvalNotificationQueue: Queue<ApprovalNotificationJobPayload> | null = null;

export async function initApprovalNotificationQueue(
  redisConnection: Redis,
): Promise<Queue<ApprovalNotificationJobPayload>> {
  if (approvalNotificationQueue) {
    return approvalNotificationQueue;
  }

  const queueConnection = duplicateRedisConnection(redisConnection);

  approvalNotificationQueue = new Queue<ApprovalNotificationJobPayload>(
    APPROVAL_NOTIFICATION_QUEUE_NAME,
    {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }
  );

  await approvalNotificationQueue.waitUntilReady();

  return approvalNotificationQueue;
}

export function getApprovalNotificationQueue(): Queue<ApprovalNotificationJobPayload> {
  if (!approvalNotificationQueue) {
    throw new Error('Approval notification queue has not been initialised yet.');
  }

  return approvalNotificationQueue;
}

export async function shutdownApprovalNotificationQueue(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (approvalNotificationQueue) {
    tasks.push(approvalNotificationQueue.close());
    approvalNotificationQueue = null;
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
