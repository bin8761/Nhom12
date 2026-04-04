import type { job, jobimage } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { searchApprovedJobsPublic } from './job.service';
import { getRedisConnection } from '../container/appContext';
import { loadAppConfig } from '../config/appConfig';
import logger from '../utils/logger';

const prisma = getPrismaClient();

const SORT_OPTIONS = ['publishedAt_desc', 'salary_desc', 'salary_asc'] as const;
export type RecommendationSortOption = (typeof SORT_OPTIONS)[number];

type RecommendationReason = 'missing_location' | 'province' | 'global';

export interface RecommendationMeta {
  limit: number;
  sort: RecommendationSortOption;
  filters: {
    provinceCode: string | null;
    provinceName?: string | null;
  };
  reason: RecommendationReason;
}

export interface CandidateRecommendationResult {
  data: Array<
    job & {
      jobimage: jobimage[];
    }
  >;
  meta: RecommendationMeta;
}

export interface CandidateRecommendationParams {
  candidateId: string;
  limit?: number;
  sort?: RecommendationSortOption;
  includeGlobal?: boolean;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const CACHE_PREFIX = 'job-rec';

function normalizeSort(sort?: string): RecommendationSortOption {
  if (sort && SORT_OPTIONS.includes(sort as RecommendationSortOption)) {
    return sort as RecommendationSortOption;
  }
  return 'publishedAt_desc';
}

/**
 * Normalize location text for fuzzy matching
 * Remove dashes, extra spaces, and common prefixes
 */
function normalizeLocationText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/^(tp\.|tỉnh|thành phố)\s*/i, '') // Remove prefix
    .replace(/[-–—]/g, ' ') // Replace all types of dashes with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

/**
 * Try to extract province code from location text
 * This is a simple implementation that matches common patterns
 */
export async function tryMatchLocationFromText(
  locationText: string,
): Promise<{ provinceCode: string } | null> {
  if (!locationText || locationText.trim().length === 0) {
    return null;
  }

  const normalizedInput = normalizeLocationText(locationText);

  // Try to find province in the database by matching names
  try {
    const provinces = await prisma.province.findMany({
      select: {
        code: true,
        name: true,
      },
    });

    for (const province of provinces) {
      const normalizedProvinceName = normalizeLocationText(province.name);

      // Check if location text contains province name (fuzzy match)
      if (
        normalizedInput.includes(normalizedProvinceName) ||
        normalizedProvinceName.includes(normalizedInput)
      ) {
        return {
          provinceCode: province.code,
        };
      }
    }
  } catch (error) {
    logger.warn({
      event: 'location_text_parsing_failed',
      locationText,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

export async function buildCandidateRecommendations(
  params: CandidateRecommendationParams,
): Promise<CandidateRecommendationResult> {
  logger.info({
    event: 'build_recommendations_start',
    candidateId: params.candidateId,
  });

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const sort = normalizeSort(params.sort);
  const cacheKey = buildCacheKey(params.candidateId, limit, sort);
  const { ttlSeconds } = loadAppConfig().recommendationCache;
  const redis = ttlSeconds > 0 ? getRedisConnection() : null;

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    select: {
      preferredProvinceCode: true,
      preferredAddressLine: true,
    },
  });

  logger.info({
    event: 'candidate_data_loaded',
    candidateId: params.candidateId,
    hasPreferredProvince: !!candidate?.preferredProvinceCode,
    hasAddressLine: !!candidate?.preferredAddressLine,
  });

  if (!candidate) {
    return {
      data: [],
      meta: {
        limit,
        sort,
        filters: {
          provinceCode: null,
        },
        reason: 'missing_location',
      },
    };
  }

  // Use preferred location if available, otherwise parse from address line
  let provinceCode = candidate.preferredProvinceCode;

  // If no preferred codes but has address line, try to parse
  if (!provinceCode && candidate.preferredAddressLine) {
    const locationMatch = await tryMatchLocationFromText(candidate.preferredAddressLine);
    if (locationMatch) {
      provinceCode = locationMatch.provinceCode;
    }
  }

  logger.info({
    event: 'after_address_line_check',
    candidateId: params.candidateId,
    provinceCode,
    willCallAuthService: !provinceCode,
  });

  // If still no location, try to get from auth-service
  if (!provinceCode) {
    logger.info({
      event: 'calling_auth_service_for_location',
      candidateId: params.candidateId,
    });

    try {
      const authApiUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
      const internalSecret = process.env.INTERNAL_SECRET || 'dev-internal-secret';
      const response = await fetch(`${authApiUrl}/internal/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
        },
        body: JSON.stringify({ userIds: [params.candidateId] }),
      });

      if (response.ok) {
        const result = await response.json();
        const userData = result?.data?.[0];
        const userLocation = userData?.location || userData?.address;
        if (userLocation) {
          const locationMatch = await tryMatchLocationFromText(userLocation);
          if (locationMatch) {
            provinceCode = locationMatch.provinceCode;
          }
        }
      }
    } catch (error) {
      logger.warn({
        event: 'auth_service_call_failed',
        candidateId: params.candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // If no location data, return global recommendations
  if (!provinceCode) {
    logger.info({
      event: 'recommendation_fallback_to_global',
      candidateId: params.candidateId,
      message: 'No location found, returning global recommendations',
    });

    const globalResult = await searchApprovedJobsPublic({
      page: 1,
      limit,
      sort,
    });

    logger.info({
      event: 'global_recommendations_result',
      candidateId: params.candidateId,
      jobCount: globalResult.data.length,
    });

    // Revive jobs to ensure proper Date objects
    const revivedJobs = globalResult.data.map((job) => reviveJob(job));

    return {
      data: revivedJobs,
      meta: {
        limit,
        sort,
        filters: {
          provinceCode: null,
        },
        reason: 'global',
      },
    };
  }

  if (redis && provinceCode) {
    const cached = await readCachedRecommendations(redis, cacheKey, provinceCode);
    if (cached) {
      return cached;
    }
  }

  const aggregated: CandidateRecommendationResult['data'] = [];
  const seen = new Set<string>();
  let reason: RecommendationReason = 'missing_location';

  const appendFromSearch = async (
    extraFilters: { provinceCode?: string },
    stageReason: Exclude<RecommendationReason, 'missing_location'>,
  ): Promise<void> => {
    if (aggregated.length >= limit) {
      return;
    }

    const result = await searchApprovedJobsPublic({
      page: 1,
      limit,
      sort,
      ...extraFilters,
    });

    for (const job of result.data) {
      if (aggregated.length >= limit) {
        break;
      }

      if (seen.has(job.id)) {
        continue;
      }

      seen.add(job.id);
      aggregated.push(job);
      if (reason === 'missing_location') {
        reason = stageReason;
      }
    }
  };

  // Search by province
  await appendFromSearch({ provinceCode }, 'province');

  // Only fallback to global if user explicitly requests it
  if (aggregated.length < limit && params.includeGlobal) {
    await appendFromSearch({}, 'global');
  }

  if (reason === 'missing_location') {
    reason = 'province'; // Show province even if no jobs found
  }

  // Get province name for display
  let provinceName: string | null = null;

  if (provinceCode) {
    const province = await prisma.province.findUnique({
      where: { code: provinceCode },
      select: { name: true },
    });
    provinceName = province?.name || null;
  }

  // Revive jobs to ensure proper Date objects
  const revivedJobs = aggregated.map((job) => reviveJob(job));

  const response: CandidateRecommendationResult = {
    data: revivedJobs,
    meta: {
      limit,
      sort,
      filters: {
        provinceCode,
        provinceName,
      },
      reason,
    },
  };

  if (redis && ttlSeconds > 0) {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', ttlSeconds).catch((error) => {
      logger.warn({
        event: 'candidate_recommendation_cache_set_failed',
        candidateId: params.candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return response;
}

export async function invalidateCandidateRecommendationCache(candidateId: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    const pattern = `${CACHE_PREFIX}:${candidateId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn({
      event: 'candidate_recommendation_cache_invalidate_failed',
      candidateId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildCacheKey(candidateId: string, limit: number, sort: RecommendationSortOption): string {
  return `${CACHE_PREFIX}:${candidateId}:${limit}:${sort}`;
}

async function readCachedRecommendations(
  redis: Redis,
  cacheKey: string,
  expectedProvince: string,
): Promise<CandidateRecommendationResult | null> {
  try {
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached) as CandidateRecommendationResult;
    if (parsed.meta.filters.provinceCode !== expectedProvince) {
      return null;
    }
    return reviveRecommendationResult(parsed);
  } catch (error) {
    logger.warn({
      event: 'candidate_recommendation_cache_read_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function reviveRecommendationResult(payload: CandidateRecommendationResult): CandidateRecommendationResult {
  return {
    ...payload,
    data: payload.data.map((job) => reviveJob(job)),
  };
}

function reviveJob(job: any): job & { jobimage: jobimage[] } {
  // Handle both 'jobimage' (from database) and 'images' (from cache/other sources)
  const imageArray = job.jobimage || job.images || [];
  
  return {
    ...job,
    salary: job.salary ? new Prisma.Decimal(job.salary as string | number) : new Prisma.Decimal(0),
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
    publishedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    deletedAt: job.deletedAt ? new Date(job.deletedAt) : null,
    jobimage: Array.isArray(imageArray)
      ? imageArray.map((image: any) => ({
          ...image,
          createdAt: new Date(image.createdAt),
        }))
      : [],
  };
}
