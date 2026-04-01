import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

export const EMPLOYER_APPROVAL_QUEUE_NAME = 'employer.approval';

const DEFAULT_BACKOFF_DELAY_MS = 2_000;

export interface EmployerApprovalJobPayload {
  userId: string;
  email: string;
  role: string;
  registrationData?: {
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: Date;
  };
}

let employerApprovalQueue: Queue<EmployerApprovalJobPayload> | null = null;

export async function initEmployerApprovalQueue(
  redisConnection: Redis,
): Promise<Queue<EmployerApprovalJobPayload>> {
  if (employerApprovalQueue) {
    return employerApprovalQueue;
  }

  const queueConnection = duplicateRedisConnection(redisConnection);

  employerApprovalQueue = new Queue<EmployerApprovalJobPayload>(EMPLOYER_APPROVAL_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  await employerApprovalQueue.waitUntilReady();

  return employerApprovalQueue;
}

export function getEmployerApprovalQueue(): Queue<EmployerApprovalJobPayload> {
  if (!employerApprovalQueue) {
    throw new Error('Employer approval queue has not been initialised yet.');
  }

  return employerApprovalQueue;
}

export async function shutdownEmployerApprovalQueue(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (employerApprovalQueue) {
    tasks.push(employerApprovalQueue.close());
    employerApprovalQueue = null;
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
