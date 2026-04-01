import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

export const PHONE_VERIFICATION_QUEUE_NAME = 'phone.verification';

const DEFAULT_BACKOFF_DELAY_MS = 2_000;

export type PhoneVerificationJobOrigin = 'register' | 'resend' | 'other';

export interface PhoneVerificationJobPayload {
  userId: string;
  phoneNumber: string;
  code: string;
  origin?: PhoneVerificationJobOrigin;
}

let phoneVerificationQueue: Queue<PhoneVerificationJobPayload> | null = null;

export async function initPhoneVerificationQueue(
  redisConnection: Redis,
): Promise<Queue<PhoneVerificationJobPayload>> {
  if (phoneVerificationQueue) {
    return phoneVerificationQueue;
  }

  const queueConnection = duplicateRedisConnection(redisConnection);

  phoneVerificationQueue = new Queue<PhoneVerificationJobPayload>(PHONE_VERIFICATION_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  await phoneVerificationQueue.waitUntilReady();

  return phoneVerificationQueue;
}

export function getPhoneVerificationQueue(): Queue<PhoneVerificationJobPayload> {
  if (!phoneVerificationQueue) {
    throw new Error('Phone verification queue has not been initialised yet.');
  }

  return phoneVerificationQueue;
}

export async function shutdownPhoneVerificationQueue(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (phoneVerificationQueue) {
    tasks.push(phoneVerificationQueue.close());
    phoneVerificationQueue = null;
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}
