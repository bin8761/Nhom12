import { Prisma, job, jobimage, job_status, job_jobType } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { getRedisConnection } from '../container/appContext';
import { loadAppConfig } from '../config/appConfig';
import { recordSearchCache } from '../metrics/jobMetrics';
import logger from '../utils/logger';

const prisma = getPrismaClient();

export interface PublicListJobsParams {
  page: number;
  limit: number;
}

export interface PublicListJobsResult {
  data: Array<
    job & {
      jobimage: jobimage[];
      employer?: any;
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchPublicJobsParams {
  page: number;
  limit: number;
  q?: string;
  provinceCode?: string;
  jobType?: job_jobType;
  salaryMin?: number;
  salaryMax?: number;
  sort?: 'publishedAt_desc' | 'salary_desc' | 'salary_asc';
}

export interface SearchPublicJobsResult extends PublicListJobsResult {
  filtersApplied: Record<string, unknown>;
}

async function fetchEmployerProfiles(employerIds: string[]): Promise<Map<string, any>> {
  if (employerIds.length === 0) {
    return new Map();
  }

  try {
    const authApiUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    const internalSecret = process.env.INTERNAL_SECRET || 'dev-internal-secret';

    const response = await fetch(`${authApiUrl}/internal/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret,
      },
      body: JSON.stringify({ userIds: employerIds }),
    });

    if (!response.ok) {
      logger.warn({
        event: 'fetch_employer_profiles_failed',
        status: response.status,
        employerCount: employerIds.length,
      });
      return new Map();
    }

    const result = await response.json();
    const users = result?.data || [];

    const employerMap = new Map();
    for (const user of users) {
      if (user.role === 'EMPLOYER' && user.employerProfile) {
        employerMap.set(user.id, {
          email: user.email,
          employerProfile: {
            companyName: user.employerProfile.companyName,
            companyWebsite: user.employerProfile.companyWebsite,
            contactEmail: user.employerProfile.contactEmail,
          },
        });
      }
    }

    return employerMap;
  } catch (error) {
    logger.warn({
      event: 'fetch_employer_profiles_error',
      error: error instanceof Error ? error.message : String(error),
      employerCount: employerIds.length,
    });
    return new Map();
  }
}

function buildSortOrder(sort: 'publishedAt_desc' | 'salary_desc' | 'salary_asc'): Prisma.jobOrderByWithRelationInput[] {
  if (sort === 'salary_desc') {
    return [
      { salary: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ];
  }
  if (sort === 'salary_asc') {
    return [
      { salary: 'asc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ];
  }

  return [
    { publishedAt: 'desc' },
    { createdAt: 'desc' },
  ];
}

function buildSearchWhereClause(params: SearchPublicJobsParams): Prisma.jobWhereInput {
  const where: Prisma.jobWhereInput = {
    status: job_status.APPROVED,
    deletedAt: null,
  };

  if (params.provinceCode) {
    where.provinceCode = params.provinceCode;
  }

  if (params.jobType) {
    where.jobType = params.jobType;
  }

  if (params.salaryMin !== undefined || params.salaryMax !== undefined) {
    where.salary = {};
    if (params.salaryMin !== undefined) {
      where.salary.gte = new Prisma.Decimal(params.salaryMin);
    }
    if (params.salaryMax !== undefined) {
      where.salary.lte = new Prisma.Decimal(params.salaryMax);
    }
  }

  if (params.q) {
    where.OR = [
      { title: { contains: params.q } },
      { description: { contains: params.q } },
      { location: { contains: params.q } },
      { addressLine: { contains: params.q } },
    ];
  }

  return where;
}

export async function listApprovedJobsPublic(params: PublicListJobsParams): Promise<PublicListJobsResult> {
  const { cacheWrapper, generatePaginationKey } = await import('../utils/cache');

  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 50);
  const skip = (page - 1) * limit;

  const cacheKey = generatePaginationKey('public:jobs', page, limit);

  return cacheWrapper(
    cacheKey,
    async () => {
      const where: Prisma.jobWhereInput = {
        status: job_status.APPROVED,
        deletedAt: null,
      };

      const [jobs, total] = await prisma.$transaction([
        prisma.job.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit,
          include: {
            jobimage: { orderBy: { slot: 'asc' } },
          },
        }),
        prisma.job.count({ where }),
      ]);

      const employerIds = [...new Set(jobs.map(job => job.employerId))];
      const employerMap = await fetchEmployerProfiles(employerIds);

      const jobsWithEmployer = jobs.map(job => ({
        ...job,
        employer: employerMap.get(job.employerId) || null,
      }));

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: jobsWithEmployer,
        pagination: { page, limit, total, totalPages },
      };
    },
    { ttl: 300, prefix: 'jobs' },
  );
}

const SEARCH_CACHE_NAMESPACE = 'job-search';
const SEARCH_FRESHNESS_KEY = `${SEARCH_CACHE_NAMESPACE}:freshness`;

function buildSearchCacheKey(params: SearchPublicJobsParams, freshnessToken: string): string {
  const payload = {
    page: params.page,
    limit: params.limit,
    q: params.q ?? null,
    provinceCode: params.provinceCode ?? null,
    jobType: params.jobType ?? null,
    salaryMin: params.salaryMin ?? null,
    salaryMax: params.salaryMax ?? null,
    sort: params.sort ?? 'publishedAt_desc',
    freshnessToken,
  };
  return `${SEARCH_CACHE_NAMESPACE}:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

export async function searchApprovedJobsPublic(params: SearchPublicJobsParams): Promise<SearchPublicJobsResult> {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 20);
  const skip = (page - 1) * limit;
  const where = buildSearchWhereClause(params);
  const orderBy = buildSortOrder(params.sort ?? 'publishedAt_desc');

  const redis = getRedisConnection();
  const ttlSeconds = loadAppConfig().searchCache.ttlSeconds;
  let freshnessToken = await redis.get(SEARCH_FRESHNESS_KEY);
  if (!freshnessToken) {
    const latest = await prisma.job.findFirst({
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    freshnessToken = latest?.updatedAt?.toISOString() ?? 'none';
    await redis.set(SEARCH_FRESHNESS_KEY, freshnessToken).catch(() => null);
  }

  const cacheKey = buildSearchCacheKey(params, freshnessToken);

  if (ttlSeconds > 0) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      recordSearchCache('hit');
      return JSON.parse(cached) as SearchPublicJobsResult;
    }
  }

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        jobimage: { orderBy: { slot: 'asc' } },
      },
    }),
    prisma.job.count({ where }),
  ]);

  const employerIds = [...new Set(jobs.map(job => job.employerId))];
  const employerMap = await fetchEmployerProfiles(employerIds);

  const jobsWithEmployer = jobs.map(job => ({
    ...job,
    employer: employerMap.get(job.employerId) || null,
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const response: SearchPublicJobsResult = {
    data: jobsWithEmployer,
    pagination: { page, limit, total, totalPages },
    filtersApplied: {
      q: params.q ?? null,
      provinceCode: params.provinceCode ?? null,
      jobType: params.jobType ?? null,
      salaryMin: params.salaryMin ?? null,
      salaryMax: params.salaryMax ?? null,
      sort: params.sort ?? 'publishedAt_desc',
    },
  };

  if (ttlSeconds > 0) {
    recordSearchCache('miss');
    await redis.set(cacheKey, JSON.stringify(response), 'EX', ttlSeconds).catch(() => null);
  }

  return response;
}
