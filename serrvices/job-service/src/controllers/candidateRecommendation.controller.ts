import type { Request, Response, NextFunction } from 'express';
import type { job, jobimage } from '@prisma/client';
import {
  buildCandidateRecommendations,
  type RecommendationSortOption,
} from '../services/recommendation.service';
import { observeRecommendationLatency, recordRecommendationsOutcome } from '../metrics/jobMetrics';
import logger from '../utils/logger';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const ALLOWED_SORTS: RecommendationSortOption[] = ['publishedAt_desc', 'salary_desc', 'salary_asc'];

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeSort(value: unknown): RecommendationSortOption {
  if (typeof value === 'string' && ALLOWED_SORTS.includes(value as RecommendationSortOption)) {
    return value as RecommendationSortOption;
  }
  return 'publishedAt_desc';
}

export async function getMyRecommendationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const start = process.hrtime.bigint();
  try {
    const currentUser = (req as any).user as { id?: string } | undefined;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const limit = normalizeLimit(req.query.limit);
    const sort = normalizeSort(req.query.sort);
    const includeGlobal = req.query.includeGlobal === 'true';

    const result = await buildCandidateRecommendations({
      candidateId: currentUser.id,
      limit,
      sort,
      includeGlobal,
    });

    res.status(200).json({
      data: result.data.map(mapJobSummary),
      meta: result.meta,
    });
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
    recordRecommendationsOutcome('success', result.meta.reason);
    observeRecommendationLatency('success', durationSeconds);
    logger.info({
      event: 'job_recommendations_request',
      candidateId: currentUser.id,
      durationMs: Math.round(durationSeconds * 1000),
      resultCount: result.data.length,
      filters: result.meta.filters,
      reason: result.meta.reason,
    });
  } catch (error) {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
    recordRecommendationsOutcome('error', 'failed');
    observeRecommendationLatency('error', durationSeconds);
    logger.error({
      event: 'job_recommendations_error',
      candidateId: (req as any).user?.id,
      durationMs: Math.round(durationSeconds * 1000),
      query: {
        limit: req.query.limit,
        sort: req.query.sort,
      },
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

type RecommendationJob = job & { jobimage: jobimage[] };

function mapJobSummary(job: RecommendationJob) {
  return {
    id: job.id,
    employerId: job.employerId,
    title: job.title,
    slug: job.slug,
    description: job.description,
    skills: Array.isArray(job.skills) ? job.skills : [],
    salary: Number(job.salary),
    currency: job.currency,
    location: job.location,
    addressLine: job.addressLine,
    provinceCode: job.provinceCode,
    provinceName: job.provinceNameSnapshot,    jobType: job.jobType,
    publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    images: job.jobimage
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((image) => ({
        id: image.id,
        filePath: image.filePath,
        slot: image.slot,
        createdAt: image.createdAt.toISOString(),
      })),
  };
}
