import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

export const EMAIL_VERIFICATION_QUEUE_NAME = 'email.verification';

const DEFAULT_BACKOFF_DELAY_MS = 1_000;

export interface EmailVerificationJobPayload {
  userId: string;
  email: string;
  verificationCode: string;
  locale?: string;
}

let emailVerificationQueue: Queue<EmailVerificationJobPayload> | null = null;

export async function initEmailVerificationQueue(
  redisConnection: Redis,
): Promise<Queue<EmailVerificationJobPayload>> {
  if (emailVerificationQueue) {
    return emailVerificationQueue;
  }

  const queueConnection = duplicateRedisConnection(redisConnection);

  emailVerificationQueue = new Queue<EmailVerificationJobPayload>(EMAIL_VERIFICATION_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  await emailVerificationQueue.waitUntilReady();

  return emailVerificationQueue;
}

export function getEmailVerificationQueue(): Queue<EmailVerificationJobPayload> {
  if (!emailVerificationQueue) {
    throw new Error('Email verification queue has not been initialised yet.');
  }

  return emailVerificationQueue;
}

export async function shutdownEmailVerificationQueue(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (emailVerificationQueue) {
    tasks.push(emailVerificationQueue.close());
    emailVerificationQueue = null;
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
