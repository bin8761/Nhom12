import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { loadAppConfig } from '../config/appConfig';
import { duplicateRedisConnection } from '../infra/redis/jobRedisClients';

export interface JobApprovalJobPayload {
  jobId: string;
  employerId: string;
  employerEmail: string | null;
  title: string;
  slug: string;
  source: 'create' | 'update';
  submittedAt: string;
}

let jobApprovalQueue: Queue<JobApprovalJobPayload> | null = null;

export async function initJobApprovalQueue(redisConnection: Redis): Promise<Queue<JobApprovalJobPayload>> {
  if (jobApprovalQueue) {
    return jobApprovalQueue;
  }

  const config = loadAppConfig();
  const queueConnection = duplicateRedisConnection(redisConnection);

  jobApprovalQueue = new Queue<JobApprovalJobPayload>(config.queues.jobApproval.name, {
    connection: queueConnection,
    prefix: config.queues.jobApproval.prefix,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
    },
  });

  await jobApprovalQueue.waitUntilReady();

  return jobApprovalQueue;
}

export function getJobApprovalQueue(): Queue<JobApprovalJobPayload> {
  if (!jobApprovalQueue) {
    throw new Error('Job approval queue has not been initialised yet.');
  }

  return jobApprovalQueue;
}

export async function shutdownJobApprovalQueue(): Promise<void> {
  if (!jobApprovalQueue) {
    return;
  }

  await jobApprovalQueue.close();
  jobApprovalQueue = null;
}
