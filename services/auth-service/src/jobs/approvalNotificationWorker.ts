import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { APPROVAL_NOTIFICATION_QUEUE_NAME, type ApprovalNotificationJobPayload } from './approvalNotificationQueue';
import { sendEmployerApprovedEmail, sendEmployerPendingReviewEmail } from '../infra/email/smtpMailer';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import logger from '../utils/logger';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

let workerInstance: Worker<ApprovalNotificationJobPayload> | null = null;

export function initApprovalNotificationWorker(redis: Redis): Worker<ApprovalNotificationJobPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = duplicateRedisConnection(redis);

  workerInstance = new Worker<ApprovalNotificationJobPayload>(
    APPROVAL_NOTIFICATION_QUEUE_NAME,
    async (job) => {
      const prisma = getPrismaClient();
      const jobId = job.id ? String(job.id) : undefined;
      const { userId, email, status, approvedBy, reason } = job.data;

      logger.info({
        event: 'approval_notification_job_started',
        jobId: job.id,
        userId,
        email,
        status,
      });

      // Upsert outbox record on start
      await prisma.emailOutbox.upsert({
        where: { jobId: jobId ?? '' },
        update: {
          status: 'RETRYING',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
        create: {
          jobId: jobId,
          userId: userId,
          email: email,
          templateKey: `employer.approval.${status}`,
          status: 'PENDING',
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });

      try {
        // Send appropriate email based on status
        switch (status) {
          case 'approved':
            await sendEmployerApprovedEmail({
              userId,
              to: email,
              approvedBy: approvedBy || 'system',
            });
            break;

          case 'pending':
            await sendEmployerPendingReviewEmail({
              userId,
              to: email,
              reason: reason || 'Your registration is under review',
            });
            break;

          case 'rejected':
            await sendEmployerPendingReviewEmail({
              userId,
              to: email,
              reason: reason || 'Your registration was not approved',
            });
            break;

          default:
            throw new Error(`Unknown approval status: ${status}`);
        }

        // Update outbox status to sent
        await prisma.emailOutbox.update({
          where: { jobId: jobId ?? '' },
          data: {
            status: 'SENT',
          },
        });

        logger.info({
          event: 'approval_notification_job_completed',
          jobId: job.id,
          userId,
          email,
          status,
          attemptsMade: job.attemptsMade,
        });
      } catch (error) {
        // Update outbox status to failed
        await prisma.emailOutbox.update({
          where: { jobId: jobId ?? '' },
          data: {
            status: 'FAILED',
            lastError: error instanceof Error ? error.message : String(error),
          },
        });

        logger.error({
          event: 'approval_notification_job_failed',
          jobId: job.id,
          userId,
          email,
          status,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    },
    { connection }
  );

  workerInstance.on('failed', async (job, error) => {
    logger.error({
      event: 'approval_notification_job_failed',
      jobId: job?.id,
      userId: job?.data?.userId,
      email: job?.data?.email,
      status: job?.data?.status,
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
            templateKey: `employer.approval.${job?.data?.status}`,
            status: 'FAILED',
            attempts: job?.attemptsMade ?? 1,
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptAt: new Date(),
          },
        });
      }
    } catch (e) {
      logger.error({ event: 'approval_notification_outbox_update_failed', error: e instanceof Error ? e.message : String(e) });
    }
  });

  workerInstance.on('error', (error) => {
    logger.error({
      event: 'approval_notification_worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return workerInstance;
}

export async function shutdownApprovalNotificationWorker(): Promise<void> {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
}
