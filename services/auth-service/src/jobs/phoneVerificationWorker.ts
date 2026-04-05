import { Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { PHONE_VERIFICATION_QUEUE_NAME, type PhoneVerificationJobPayload } from './phoneVerificationQueue';
import { sendPhoneVerificationSms } from '../infra/sms/smsProvider';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import logger from '../utils/logger';
import { duplicateRedisConnection } from '../infra/redis/redisClient';
import {
  recordPhoneOtpFailed,
  recordPhoneOtpSent,
  recordPhoneOtpWorkerFailed,
} from '../metrics/phoneVerificationMetrics';

let workerInstance: Worker<PhoneVerificationJobPayload> | null = null;

export function initPhoneVerificationWorker(redis: Redis): Worker<PhoneVerificationJobPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = duplicateRedisConnection(redis);

  workerInstance = new Worker<PhoneVerificationJobPayload>(
    PHONE_VERIFICATION_QUEUE_NAME,
    async (job) => {
      const prisma = getPrismaClient();
      const now = new Date();

      logger.info({
        event: 'phone_verification_job_started',
        jobId: job.id,
        userId: job.data.userId,
        phoneNumber: job.data.phoneNumber,
        attemptsMade: job.attemptsMade,
      });

      const data: Prisma.PhoneVerificationUpdateManyMutationInput = {
        lastSentAt: now,
      };
      if (job.attemptsMade > 1) {
        data.sentCount = { increment: 1 };
      }

      const result = await prisma.phoneVerification.updateMany({
        where: {
          userId: job.data.userId,
          phoneNumber: job.data.phoneNumber,
        },
        data,
      });

      if (result.count === 0) {
        logger.warn({
          event: 'phone_verification_record_missing',
          jobId: job.id,
          userId: job.data.userId,
          phoneNumber: job.data.phoneNumber,
        });
      }

      await sendPhoneVerificationSms({
        userId: job.data.userId,
        phoneNumber: job.data.phoneNumber,
        code: job.data.code,
      });

      recordPhoneOtpSent(job.data.origin);

      logger.info({
        event: 'phone_verification_sent',
        jobId: job.id,
        userId: job.data.userId,
        phoneNumber: job.data.phoneNumber,
        attemptsMade: job.attemptsMade,
      });

      logger.info({
        event: 'phone_verification_job_completed',
        jobId: job.id,
        userId: job.data.userId,
        phoneNumber: job.data.phoneNumber,
        attemptsMade: job.attemptsMade,
      });
    },
    {
      connection,
    },
  );

  workerInstance.on('failed', (job, error) => {
    recordPhoneOtpFailed('send_failed');
    recordPhoneOtpWorkerFailed('send_failed');

    logger.error({
      event: 'phone_verification_failed',
      reason: 'sms_send_failed',
      jobId: job?.id,
      userId: job?.data?.userId,
      phoneNumber: job?.data?.phoneNumber,
      attemptsMade: job?.attemptsMade,
      error: error instanceof Error ? error.message : String(error),
    });

    logger.error({
      event: 'phone_verification_job_failed',
      jobId: job?.id,
      userId: job?.data?.userId,
      phoneNumber: job?.data?.phoneNumber,
      attemptsMade: job?.attemptsMade,
      error: error instanceof Error ? error.message : String(error),
    });

    logger.error({
      event: 'phone_verification_worker_alert',
      severity: 'critical',
      jobId: job?.id,
      userId: job?.data?.userId,
      phoneNumber: job?.data?.phoneNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  workerInstance.on('error', (error) => {
    recordPhoneOtpWorkerFailed('worker_error');

    logger.error({
      event: 'phone_verification_worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return workerInstance;
}

export async function shutdownPhoneVerificationWorker(): Promise<void> {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
}
