import { Worker, Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { JobApprovalJobPayload } from './jobApprovalQueue';
import logger from '../utils/logger';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { job_status } from '@prisma/client';
import { appendJobLog } from '../services/audit-log.service';
import { publishJobApprovedEvent } from '../events/jobEvents';
import { sendJobApprovedEmail } from '../infra/email/smtpMailer';
import { loadAppConfig } from '../config/appConfig';
import { duplicateRedisConnection } from '../infra/redis/jobRedisClients';

let worker: Worker<JobApprovalJobPayload> | null = null;
let deadLetterQueue: Queue<JobApprovalJobPayload> | null = null;

function shouldAutoApprove(): boolean {
  // Placeholder rules; extend per TDD (e.g., check employer score).
  return true;
}

export function initJobApprovalWorker(redis: Redis): Worker<JobApprovalJobPayload> {
  if (worker) {
    return worker;
  }

  const connection = duplicateRedisConnection(redis);
  const prisma = getPrismaClient();

  const { queues } = loadAppConfig();

  deadLetterQueue = new Queue<JobApprovalJobPayload>('jobApprovalQueue:dlq', {
    connection: duplicateRedisConnection(redis),
    prefix: queues.jobApproval.prefix,
  });

  worker = new Worker<JobApprovalJobPayload>(
    queues.jobApproval.name,
    async (job: Job<JobApprovalJobPayload>) => {
      logger.info({
        event: 'job_post_worker_worker_started',
        jobId: job.data.jobId,
        source: job.data.source,
      });

      const existing = await prisma.job.findUnique({
        where: { id: job.data.jobId },
      });

      if (!existing) {
        logger.warn({
          event: 'job_post_worker_job_missing',
          jobId: job.data.jobId,
        });
        return;
      }

      if (existing.status !== job_status.PENDING) {
        logger.info({
          event: 'job_post_worker_job_skipped',
          jobId: job.data.jobId,
          currentStatus: existing.status,
        });
        return;
      }

      if (!shouldAutoApprove()) {
        logger.info({
          event: 'job_post_worker_requires_manual',
          jobId: job.data.jobId,
        });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const jobRecord = await tx.job.update({
          where: { id: job.data.jobId },
          data: {
            status: job_status.APPROVED,
            publishedAt: new Date(),
          },
        });

        await appendJobLog({
          jobId: jobRecord.id,
          action: 'AUTO_APPROVED',
          performedBy: null,
          tx,
        });

        return jobRecord;
      });

      try {
        publishJobApprovedEvent({
          jobId: updated.id,
          employerId: updated.employerId,
          title: updated.title,
          slug: updated.slug,
          approvedBy: 'worker',
          approvedAt: updated.publishedAt?.toISOString() ?? new Date().toISOString(),
        });
      } catch (eventError) {
        logger.warn({
          event: 'job_post_worker_event_failed',
          jobId: updated.id,
          error: eventError instanceof Error ? eventError.message : String(eventError),
        });
      }

      const recipient = job.data.employerEmail ?? existing.employerEmail ?? null;
      if (recipient) {
        try {
          await sendJobApprovedEmail({
            to: recipient,
            jobTitle: updated.title,
            jobId: updated.id,
            slug: updated.slug,
          });
        } catch (emailError) {
          logger.warn({
            event: 'job_post_worker_email_failed',
            jobId: updated.id,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }
      }

      logger.info({
        event: 'job_post_worker_worker_completed',
        jobId: job.data.jobId,
      });
    },
    {
      connection,
      prefix: queues.jobApproval.prefix,
    },
  );

  worker.on('failed', async (job, error) => {
    logger.error({
      event: 'job_post_worker_worker_failed',
      jobId: job?.data?.jobId,
      attempts: job?.attemptsMade,
      error: error instanceof Error ? error.message : String(error),
    });

    if (deadLetterQueue && job) {
      await deadLetterQueue.add('dead-letter', job.data, {
        attempts: 1,
        removeOnComplete: true,
      });
    }
  });

  worker.on('error', (error) => {
    logger.error({
      event: 'job_post_worker_worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return worker;
}

export async function shutdownJobApprovalWorker(): Promise<void> {
  if (!worker) {
    return;
  }

  await worker.close();
  worker = null;

  if (deadLetterQueue) {
    await deadLetterQueue.close();
    deadLetterQueue = null;
  }
}
