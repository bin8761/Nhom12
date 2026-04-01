import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { EMAIL_VERIFICATION_QUEUE_NAME, type EmailVerificationJobPayload } from './emailVerificationQueue';
import { sendVerificationEmail, sendPasswordResetEmail } from '../infra/email/smtpMailer';
import logger from '../utils/logger';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

let workerInstance: Worker<EmailVerificationJobPayload> | null = null;

export function initEmailVerificationWorker(redis: Redis): Worker<EmailVerificationJobPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = duplicateRedisConnection(redis);

  workerInstance = new Worker<EmailVerificationJobPayload>(
    EMAIL_VERIFICATION_QUEUE_NAME,
    async (job) => {
      const prisma = getPrismaClient();
      const jobId = job.id ? String(job.id) : undefined;

      // upsert outbox record on start
      const templateKey =
        job.name === 'password-reset' ? 'auth.password.reset' : 'auth.email.verification';

      await prisma.emailOutbox.upsert({
        where: { jobId: jobId ?? '' },
        update: {
          status: 'RETRYING',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
        create: {
          jobId: jobId,
          userId: job.data.userId,
          email: job.data.email,
          templateKey,
          status: 'PENDING',
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });
      logger.info({
        event: job.name === 'password-reset' ? 'password_reset_email_job_started' : 'email_verification_job_started',
        jobId: job.id,
        userId: job.data.userId,
        email: job.data.email,
        attemptsMade: job.attemptsMade,
      });

      if (job.name === 'password-reset') {
        await sendPasswordResetEmail({
          userId: job.data.userId,
          to: job.data.email,
          code: job.data.verificationCode,
          locale: job.data.locale,
        });
        logger.info({
          event: 'password_reset_email_sent',
          jobId: job.id,
          userId: job.data.userId,
          email: job.data.email,
        });
      } else {
        await sendVerificationEmail({
          userId: job.data.userId,
          to: job.data.email,
          code: job.data.verificationCode,
          locale: job.data.locale,
        });
      }

      await prisma.emailOutbox.update({
        where: { jobId: jobId ?? '' },
        data: {
          status: 'SENT',
        },
      });

      logger.info({
        event: job.name === 'password-reset' ? 'password_reset_email_job_completed' : 'email_verification_job_completed',
        jobId: job.id,
        userId: job.data.userId,
        email: job.data.email,
        attemptsMade: job.attemptsMade,
      });
    },
    {
      connection,
    },
  );

  workerInstance.on('failed', async (job, error) => {
    logger.error({
      event: job?.name === 'password-reset' ? 'password_reset_email_job_failed' : 'email_verification_job_failed',
      jobId: job?.id,
      userId: job?.data?.userId,
      email: job?.data?.email,
      attemptsMade: job?.attemptsMade,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const prisma = getPrismaClient();
      const jobId = job?.id ? String(job.id) : undefined;
      if (jobId) {
        await prisma.emailOutbox.upsert({
          where: { jobId },
          update: {
            status: job.attemptsMade < (job.opts.attempts ?? 1) ? 'RETRYING' : 'FAILED',
            attempts: job.attemptsMade,
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptAt: new Date(),
          },
          create: {
            jobId,
            userId: job?.data?.userId,
            email: job?.data?.email ?? 'unknown',
            templateKey: job?.name === 'password-reset' ? 'auth.password.reset' : 'auth.email.verification',
            status: 'FAILED',
            attempts: job?.attemptsMade ?? 1,
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptAt: new Date(),
          },
        });
      }
    } catch (e) {
      logger.error({ event: 'email_outbox_update_failed', error: e instanceof Error ? e.message : String(e) });
    }
  });

  workerInstance.on('error', (error) => {
    logger.error({
      event: 'email_verification_worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return workerInstance;
}

export async function shutdownEmailVerificationWorker(): Promise<void> {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
}
