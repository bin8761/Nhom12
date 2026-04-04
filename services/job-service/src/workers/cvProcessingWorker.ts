import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import path from 'path';
import { CandidateCvStatus } from '@prisma/client';
import { loadAppConfig } from '../config/appConfig';
import { duplicateRedisConnection } from '../infra/redis/jobRedisClients';
import type { CvProcessingJobPayload } from '../jobs/cvProcessingQueue';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { CVStorageService } from '../services/cv/cvStorageService';
import { GeminiCvAnalysisService } from '../services/cv/geminiCvAnalysisService';
import {
  observeCvParseDuration,
  recordCvParseResult,
} from '../metrics/cvMetrics';
import { publishCvParsedEvent } from '../events/jobEvents';
import logger from '../utils/logger';

const prisma = getPrismaClient();
const config = loadAppConfig();
const cvStorageService = new CVStorageService(config.storage.cv);
const geminiService = new GeminiCvAnalysisService(config.gemini);

let worker: Worker<CvProcessingJobPayload> | null = null;
export async function initCvProcessingWorker(redisConnection: Redis): Promise<void> {
  if (worker) {
    return;
  }

  const workerConnection = duplicateRedisConnection(redisConnection);

  worker = new Worker<CvProcessingJobPayload>(
    config.queues.cvProcessing.name,
    async (job) => {
      const { cvId, candidateId, filePath, originalFileName } = job.data;
      const parseStartedAt = Date.now();
      const absolutePath = cvStorageService.getFilePath(filePath);

      logger.info({
        event: 'cv_processing_job_started',
        cvId,
        candidateId,
        jobId: job.id,
        fileName: originalFileName,
      });

      try {
        logger.info({
          event: 'cv_processing_ai_analysis_started',
          cvId,
          candidateId,
        });

        const analysis = await geminiService.analyzeCv({
          candidateId,
          filePath: absolutePath,
          fileName: originalFileName ?? path.basename(filePath),
          requestId: job.id ?? undefined,
        });

        const parsedFieldsJson = JSON.parse(JSON.stringify(analysis.parsedFields ?? {}));

        logger.info({
          event: 'cv_processing_updating_database',
          cvId,
          candidateId,
        });

        await prisma.candidateCv.update({
          where: { id: cvId },
          data: {
            status: CandidateCvStatus.PARSED,
            parsedFields: JSON.stringify(parsedFieldsJson),
            processedAt: new Date(),
            errorMessage: null,
          },
        });

        const durationSeconds = (Date.now() - parseStartedAt) / 1000;
        observeCvParseDuration(durationSeconds);
        recordCvParseResult('success', 'gemini');

        logger.info({
          event: 'cv_processing_success',
          cvId,
          candidateId,
          durationSeconds: durationSeconds.toFixed(2),
        });

        publishCvParsedEvent({
          cvId,
          candidateId,
          parsedFields: parsedFieldsJson,
          parsedAt: new Date().toISOString(),
        });
      } catch (error) {
        const durationSeconds = (Date.now() - parseStartedAt) / 1000;
        observeCvParseDuration(durationSeconds);
        recordCvParseResult('error', 'gemini');

        logger.error({
          event: 'cv_processing_error',
          cvId,
          candidateId,
          durationSeconds: durationSeconds.toFixed(2),
          error: error instanceof Error ? error.message : String(error),
        });

        await prisma.candidateCv
          .update({
            where: { id: cvId },
            data: {
              status: CandidateCvStatus.FAILED,
              errorMessage: error instanceof Error ? error.message : 'CV analysis failed',
            },
          })
          .catch((updateError) => {
            logger.error({
              event: 'cv_processing_status_update_failed',
              cvId,
              error: updateError instanceof Error ? updateError.message : String(updateError),
            });
          });

        throw error;
      }
    },
    {
      connection: workerConnection,
      prefix: config.queues.cvProcessing.prefix,
      concurrency: 2,
    },
  );

  worker.on('completed', (job) => {
    logger.info({
      event: 'cv_processing_completed',
      cvId: job.data.cvId,
      candidateId: job.data.candidateId,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error({
      event: 'cv_processing_failed',
      cvId: job?.data?.cvId,
      candidateId: job?.data?.candidateId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  await worker.waitUntilReady();
  logger.info('[Workers] CV processing worker initialised');
}

export async function shutdownCvProcessingWorker(): Promise<void> {
  await Promise.allSettled([
    worker?.close(),
  ]);
  worker = null;
}
