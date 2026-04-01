import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { EMPLOYER_APPROVAL_QUEUE_NAME, type EmployerApprovalJobPayload } from './employerApprovalQueue';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { publishEmployerApprovalEvent } from '../events/authEvents';
import { getApprovalNotificationQueue } from './approvalNotificationQueue';
import { loadAppConfig } from '../config/appConfig';
import logger from '../utils/logger';
import { duplicateRedisConnection } from '../infra/redis/redisClient';

let workerInstance: Worker<EmployerApprovalJobPayload> | null = null;

export function initEmployerApprovalWorker(redis: Redis): Worker<EmployerApprovalJobPayload> {
  if (workerInstance) {
    return workerInstance;
  }

  const connection = duplicateRedisConnection(redis);

  workerInstance = new Worker<EmployerApprovalJobPayload>(
    EMPLOYER_APPROVAL_QUEUE_NAME,
    async (job) => {
      const prisma = getPrismaClient();
      const config = loadAppConfig();
      const { userId, email, role } = job.data;

      logger.info({
        event: 'employer_approval_job_started',
        jobId: job.id,
        userId,
        email,
        role,
      });

      try {
        // Check if user exists and email is verified
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error(`User ${userId} not found`);
        }

        if (!user.emailVerified) {
          logger.info({
            event: 'employer_approval_skipped',
            userId,
            reason: 'email_not_verified',
          });
          return;
        }

        // Run domain validation rules
        const shouldAutoApprove = await checkAutoApprovalRules(user, config);

        if (shouldAutoApprove) {
          // Auto approve the employer
          await prisma.user.update({
            where: { id: userId },
            data: {
              status: 'ACTIVE',
              approvalStatus: 'APPROVED',
              approvedAt: new Date(),
              approvedBy: 'system',
            },
          });

          // Queue notification email
          const notificationQueue = getApprovalNotificationQueue();
          await notificationQueue.add('send_approved', {
            userId,
            email,
            status: 'approved',
            approvedBy: 'system',
          });

          // Publish approval event
          await publishEmployerApprovalEvent({
            userId,
            email,
            role: 'employer',
            approvalStatus: 'approved',
            approvedBy: 'system',
            approvedAt: new Date().toISOString(),
          });

          logger.info({
            event: 'employer_auto_approved',
            userId,
            email,
          });
        } else {
          // Mark as needing manual review
          await prisma.user.update({
            where: { id: userId },
            data: {
              approvalStatus: 'PENDING',
            },
          });

          // Queue notification email for manual review
          const notificationQueue = getApprovalNotificationQueue();
          await notificationQueue.add('send_pending_review', {
            userId,
            email,
            status: 'pending',
            reason: 'Domain not in trusted list',
          });

          // Publish pending event
          await publishEmployerApprovalEvent({
            userId,
            email,
            role: 'employer',
            approvalStatus: 'pending',
            approvedBy: null,
            approvedAt: new Date().toISOString(),
          });

          logger.info({
            event: 'employer_needs_manual_approval',
            userId,
            email,
          });
        }
      } catch (error) {
        logger.error({
          event: 'employer_approval_job_failed',
          jobId: job.id,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    { connection }
  );

  workerInstance.on('failed', (job, error) => {
    logger.error({
      event: 'employer_approval_job_failed',
      jobId: job?.id,
      userId: job?.data?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  workerInstance.on('error', (error) => {
    logger.error({
      event: 'employer_approval_worker_error',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return workerInstance;
}

// Domain validation logic
async function checkAutoApprovalRules(user: any, config: any): Promise<boolean> {
  const email = user.email.toLowerCase();
  const emailDomain = email.split('@')[1];

  if (!emailDomain) {
    return false;
  }

  // Check against blocked domains
  if (config.employerApproval?.blockedDomains?.includes(emailDomain)) {
    return false;
  }

  // Check against trusted domains
  if (config.employerApproval?.trustedDomains?.includes(emailDomain)) {
    return true;
  }

  // Basic format validation - reject disposable email domains
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
  ];

  if (disposableDomains.includes(emailDomain)) {
    return false;
  }

  // Default: require manual review for unknown domains
  return false;
}

export async function shutdownEmployerApprovalWorker(): Promise<void> {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
}
