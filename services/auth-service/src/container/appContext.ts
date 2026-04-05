import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { AppConfig, loadAppConfig } from '../config/appConfig';
import { getRedisClient, initRedisClient, shutdownRedisClient } from '../infra/redis/redisClient';
import {
  EmailVerificationJobPayload,
  getEmailVerificationQueue,
  initEmailVerificationQueue,
  shutdownEmailVerificationQueue,
} from '../jobs/emailVerificationQueue';
import {
  CleanupJobPayload,
  getCleanupQueue,
  initCleanupQueue,
  scheduleCleanupJobs,
  shutdownCleanupQueue,
} from '../jobs/cleanupQueue';
import {
  EmployerApprovalJobPayload,
  getEmployerApprovalQueue,
  initEmployerApprovalQueue,
  shutdownEmployerApprovalQueue,
} from '../jobs/employerApprovalQueue';
import {
  ApprovalNotificationJobPayload,
  getApprovalNotificationQueue,
  initApprovalNotificationQueue,
  shutdownApprovalNotificationQueue,
} from '../jobs/approvalNotificationQueue';
import {
  PhoneVerificationJobPayload,
  getPhoneVerificationQueue,
  initPhoneVerificationQueue,
  shutdownPhoneVerificationQueue,
} from '../jobs/phoneVerificationQueue';
import { shutdownEmailVerificationWorker } from '../jobs/emailVerificationWorker';
import { shutdownPhoneVerificationWorker } from '../jobs/phoneVerificationWorker';
import { closeNatsConnection } from '../infra/nats/natsClient';

export interface QueuesContext {
  emailVerification: Queue<EmailVerificationJobPayload>;
  cleanup: Queue<CleanupJobPayload>;
  employerApproval: Queue<EmployerApprovalJobPayload>;
  approvalNotification: Queue<ApprovalNotificationJobPayload>;
  phoneVerification: Queue<PhoneVerificationJobPayload>;
}

export interface AppContext {
  config: AppConfig;
  redis: Redis;
  queues: QueuesContext;
}

let contextPromise: Promise<AppContext> | null = null;

export async function bootstrapAppContext(): Promise<AppContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const config = loadAppConfig();
      const redis = await initRedisClient();
      const emailVerificationQueue = await initEmailVerificationQueue(redis);
      const cleanupQueue = await initCleanupQueue(redis);
      const employerApprovalQueue = await initEmployerApprovalQueue(redis);
      const approvalNotificationQueue = await initApprovalNotificationQueue(redis);
      const phoneVerificationQueue = await initPhoneVerificationQueue(redis);

      return {
        config,
        redis,
        queues: {
          emailVerification: emailVerificationQueue,
          cleanup: cleanupQueue,
          employerApproval: employerApprovalQueue,
          approvalNotification: approvalNotificationQueue,
          phoneVerification: phoneVerificationQueue,
        },
      } satisfies AppContext;
    })();
  }

  return contextPromise;
}

export function getRedisConnection(): Redis {
  return getRedisClient();
}

export function getEmailVerificationQueueContext(): Queue<EmailVerificationJobPayload> {
  return getEmailVerificationQueue();
}

export function getCleanupQueueContext(): Queue<CleanupJobPayload> {
  return getCleanupQueue();
}

export function getEmployerApprovalQueueContext(): Queue<EmployerApprovalJobPayload> {
  return getEmployerApprovalQueue();
}

export function getApprovalNotificationQueueContext(): Queue<ApprovalNotificationJobPayload> {
  return getApprovalNotificationQueue();
}

export function getPhoneVerificationQueueContext(): Queue<PhoneVerificationJobPayload> {
  return getPhoneVerificationQueue();
}

export async function shutdownAppContext(): Promise<void> {
  contextPromise = null;

  await shutdownEmailVerificationWorker();
  await shutdownPhoneVerificationWorker();

  await Promise.allSettled([
    shutdownEmailVerificationQueue(),
    shutdownCleanupQueue(),
    shutdownEmployerApprovalQueue(),
    shutdownApprovalNotificationQueue(),
    shutdownPhoneVerificationQueue(),
    shutdownRedisClient(),
    closeNatsConnection(),
  ]);
}
