import { Queue, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';
import { loadAppConfig } from '../config/appConfig';
import { duplicateRedisConnection } from '../infra/redis/jobRedisClients';
import { incrementCvDlq, setCvQueueDepth } from '../metrics/cvMetrics';
import logger from '../utils/logger';

export interface CvProcessingJobPayload {
  cvId: string;
  candidateId: string;
  filePath: string;
  originalFileName?: string;
}

let cvProcessingQueue: Queue<CvProcessingJobPayload> | null = null;
let cvProcessingDlq: Queue<CvProcessingJobPayload> | null = null;
let cvProcessingEvents: QueueEvents | null = null;

async function refreshQueueDepth(): Promise<void> {
  if (!cvProcessingQueue) {
    return;
  }

  try {
    const config = loadAppConfig();
    const counts = await cvProcessingQueue.getJobCounts('waiting', 'delayed');
    const depth = (counts.waiting ?? 0) + (counts.delayed ?? 0);
    setCvQueueDepth(config.queues.cvProcessing.name, depth);
  } catch (error) {
    logger.warn(
      { event: 'cv_processing_queue_depth_failed', error: error instanceof Error ? error.message : String(error) },
      'Failed to update CV queue depth gauge',
    );
  }
}

export async function initCvProcessingQueue(redisConnection: Redis): Promise<Queue<CvProcessingJobPayload>> {
  if (cvProcessingQueue) {
    return cvProcessingQueue;
  }

  const config = loadAppConfig();
  const queueConnection = duplicateRedisConnection(redisConnection);
  const dlqConnection = duplicateRedisConnection(redisConnection);
  const eventsConnection = duplicateRedisConnection(redisConnection);

  cvProcessingQueue = new Queue<CvProcessingJobPayload>(config.queues.cvProcessing.name, {
    connection: queueConnection,
    prefix: config.queues.cvProcessing.prefix,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  });

  cvProcessingDlq = new Queue<CvProcessingJobPayload>(config.queues.cvProcessing.dlqName, {
    connection: dlqConnection,
    prefix: config.queues.cvProcessing.prefix,
  });

  cvProcessingEvents = new QueueEvents(config.queues.cvProcessing.name, {
    connection: eventsConnection,
    prefix: config.queues.cvProcessing.prefix,
  });

  cvProcessingEvents.on('waiting', refreshQueueDepth);
  cvProcessingEvents.on('completed', refreshQueueDepth);
  cvProcessingEvents.on('failed', async (event) => {
    incrementCvDlq('failure');
    await refreshQueueDepth();

    if (!cvProcessingQueue || !cvProcessingDlq || !event.jobId) {
      return;
    }

    try {
      const failedJob = await cvProcessingQueue.getJob(event.jobId);
      if (failedJob) {
        await cvProcessingDlq.add('failed', failedJob.data, { removeOnComplete: true });
      }
    } catch (error) {
      logger.error(
        {
          event: 'cv_processing_dlq_enqueue_failed',
          jobId: event.jobId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to enqueue job into CV DLQ',
      );
    }
  });
  cvProcessingEvents.on('stalled', refreshQueueDepth);

  await Promise.all([
    cvProcessingQueue.waitUntilReady(),
    cvProcessingDlq.waitUntilReady(),
    cvProcessingEvents.waitUntilReady(),
  ]);
  await refreshQueueDepth();

  return cvProcessingQueue;
}

export function getCvProcessingQueue(): Queue<CvProcessingJobPayload> {
  if (!cvProcessingQueue) {
    throw new Error('CV processing queue has not been initialised yet.');
  }

  return cvProcessingQueue;
}

export async function shutdownCvProcessingQueue(): Promise<void> {
  await Promise.allSettled([
    cvProcessingQueue?.close(),
    cvProcessingDlq?.close(),
    cvProcessingEvents?.close(),
  ]);
  cvProcessingQueue = null;
  cvProcessingDlq = null;
  cvProcessingEvents = null;
}
