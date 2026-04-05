import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Transporter } from 'nodemailer';
import type { NatsConnection } from 'nats';
import { AppConfig, loadAppConfig } from '../config/appConfig';
import { getRedisClient, initRedisClient, shutdownRedisClient } from '../infra/redis/redisClient';
import {
  getBullQueueRedis,
  getRateLimitRedis,
  initBullQueueRedis,
  initRateLimitRedis,
  shutdownBullQueueRedis,
  shutdownRateLimitRedis,
} from '../infra/redis/jobRedisClients';
import {
  initMailerTransport,
  shutdownMailerTransport,
} from '../infra/email/smtpMailer';
import {
  closeNatsConnection,
  getNatsConnectionOrNull,
  initNatsConnection,
} from '../infra/nats/natsClient';
import {
  getJobApprovalQueue,
  initJobApprovalQueue,
  shutdownJobApprovalQueue,
  type JobApprovalJobPayload,
} from '../jobs/jobApprovalQueue';
import {
  getCvProcessingQueue,
  initCvProcessingQueue,
  shutdownCvProcessingQueue,
  type CvProcessingJobPayload,
} from '../jobs/cvProcessingQueue';

export interface QueuesContext {
  jobApproval: Queue<JobApprovalJobPayload>;
  cvProcessing: Queue<CvProcessingJobPayload>;
}

export interface AppContext {
  config: AppConfig;
  redis: Redis;
  redisClients: {
    rateLimit: Redis;
    bullQueue: Redis;
  };
  mailer: Transporter;
  eventBus: NatsConnection | null;
  queues: QueuesContext;
}

let contextPromise: Promise<AppContext> | null = null;

export async function bootstrapAppContext(): Promise<AppContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const config = loadAppConfig();
      const redis = await initRedisClient();
      const [rateLimitRedis, bullQueueRedis] = await Promise.all([
        initRateLimitRedis(),
        initBullQueueRedis(),
      ]);
      const mailer = initMailerTransport();
      let eventBus: NatsConnection | null = null;
      if (config.eventBus.url) {
        try {
          eventBus = await initNatsConnection({
            servers: config.eventBus.url,
          });
        } catch (error) {
          console.warn('[AppContext] Unable to connect to NATS, continuing without event bus.', error);
        }
      }
      const [jobApprovalQueue, cvProcessingQueue] = await Promise.all([
        initJobApprovalQueue(bullQueueRedis),
        initCvProcessingQueue(bullQueueRedis),
      ]);

      return {
        config,
        redis,
        redisClients: {
          rateLimit: rateLimitRedis,
          bullQueue: bullQueueRedis,
        },
        mailer,
        eventBus,
        queues: {
          jobApproval: jobApprovalQueue,
          cvProcessing: cvProcessingQueue,
        },
      } satisfies AppContext;
    })();
  }

  return contextPromise;
}

export function getRedisConnection(): Redis {
  return getRedisClient();
}

export function getRateLimitRedisConnection(): Redis {
  return getRateLimitRedis();
}

export function getBullQueueRedisConnection(): Redis {
  return getBullQueueRedis();
}

export function getMailerConnection(): Transporter {
  return initMailerTransport();
}

export function getEventBusConnection(): NatsConnection | null {
  return getNatsConnectionOrNull();
}

export function getJobApprovalQueueContext(): Queue<JobApprovalJobPayload> {
  return getJobApprovalQueue();
}

export function getCvProcessingQueueContext(): Queue<CvProcessingJobPayload> {
  return getCvProcessingQueue();
}

export async function shutdownAppContext(): Promise<void> {
  contextPromise = null;

  await Promise.allSettled([
    shutdownJobApprovalQueue(),
    shutdownCvProcessingQueue(),
    shutdownRedisClient(),
    shutdownRateLimitRedis(),
    shutdownBullQueueRedis(),
    shutdownMailerTransport(),
    closeNatsConnection(),
  ]);
}
