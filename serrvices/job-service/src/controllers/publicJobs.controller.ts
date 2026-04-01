import type { Request, Response, NextFunction } from 'express';
import { job_jobType } from '@prisma/client';
import { listApprovedJobsPublic, searchApprovedJobsPublic } from '../services/job.service';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { observeSearchLatency, recordSearchRequest } from '../metrics/jobMetrics';

// Helper to safely convert Date to ISO string (handles both Date objects and strings from cache)
function toISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return date.toISOString();
}

// Helper to map employer info from job
function mapEmployerInfo(job: any) {
  return {
    employerEmail: job.employer?.email,
    employerProfile: job.employer?.employerProfile ? {
      companyName: job.employer.employerProfile.companyName,
      companyWebsite: job.employer.employerProfile.companyWebsite,
      contactEmail: job.employer.employerProfile.contactEmail,
    } : undefined,
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function normalizePagination(queryValue: unknown, fallback: number, min = 1, max = 50): number {
  const parsed = Number(queryValue);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export async function getPublicJobDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Job ID is required',
      });
      return;
    }

    const { getCache, setCache } = await import('../utils/cache');
    const cacheKey = `public:job:${jobId}`;
    
    // Try cache first
    const cached = await getCache<any>(cacheKey, 'jobs');
    if (cached) {
      res.status(200).json({ data: cached });
      return;
    }

    // Query database
    const { getPrismaClient } = await import('../infra/prisma/prismaClient');
    const prisma = getPrismaClient();
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        status: 'APPROVED',
        deletedAt: null,
      },
      include: {
        jobimage: {
          orderBy: { slot: 'asc' },
        },
        document: true,
      },
    });

    if (!job) {
      res.status(404).json({
        code: 'ERR_NOT_FOUND',
        message: 'Job not found',
      });
      return;
    }

    // Parse skills from JSON string if needed
    console.log('🔍 DEBUG job.skills:', job.skills);
    console.log('🔍 DEBUG typeof:', typeof job.skills);
    console.log('🔍 DEBUG isArray:', Array.isArray(job.skills));
    
    let skills: string[] = [];
    if (Array.isArray(job.skills)) {
      skills = job.skills;
    } else if (typeof job.skills === 'string') {
      try {
        const parsed = JSON.parse(job.skills);
        skills = Array.isArray(parsed) ? parsed : [];
      } catch {
        skills = [];
      }
    }
    
    console.log('✅ Final skills:', skills);

    // Fetch employer info from auth-service
    let employerInfo = null;
    try {
      const authApiUrl = process.env.AUTH_API_URL || 'http://localhost:3001';
      const response = await fetch(`${authApiUrl}/api/users/${job.employerId}/public`);
      if (response.ok) {
        const data = await response.json();
        if (data?.data) {
          const userData = data.data;
          employerInfo = {
            companyName: userData.employerProfile?.companyName || 'Công ty',
            email: userData.email,
            phone: userData.employerProfile?.phone,
            address: userData.employerProfile?.address,
            website: userData.employerProfile?.website,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch employer info:', error);
      // Continue without employer info
    }

    const result = {
      id: job.id,
      employerId: job.employerId,
      employer: employerInfo,
      title: job.title,
      slug: job.slug,
      description: job.description,
      skills,
      salary: Number(job.salary),
      currency: job.currency,
      location: job.location,
      addressLine: job.addressLine,
      provinceCode: job.provinceCode,
      provinceName: job.provinceNameSnapshot,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      status: job.status,
      publishedAt: toISOString(job.publishedAt),
      createdAt: toISOString(job.createdAt)!,
      updatedAt: toISOString(job.updatedAt)!,
      images: job.jobimage.map((image) => {
        // Convert DB path to URL path
        // DB stores: storage/job-images/xxx/file.png
        // Express serves /storage -> storage/ folder
        // So URL should be: /storage/job-images/xxx/file.png
        let relativePath = image.filePath.replace(/\\/g, '/');
        
        // Remove any absolute path prefix (e.g., /var/www/)
        if (relativePath.includes('storage/job-images/')) {
          const index = relativePath.indexOf('storage/job-images/');
          relativePath = '/' + relativePath.substring(index);
        } else if (!relativePath.startsWith('/')) {
          relativePath = '/' + relativePath;
        }
        
        return {
          id: image.id,
          filePath: relativePath,
          slot: image.slot,
          createdAt: toISOString(image.createdAt)!,
        };
      }),
      document: job.document ? {
        id: job.document.id,
        filePath: '/uploads/documents/' + job.document.filePath.replace(/\\/g, '/'),
        originalName: job.document.originalName,
        fileSize: job.document.fileSize,
        createdAt: toISOString(job.document.createdAt)!,
      } : null,
    };

    // Cache for 5 minutes
    await setCache(cacheKey, result, { ttl: 300, prefix: 'jobs' });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function listApprovedJobsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = normalizePagination(req.query.page, DEFAULT_PAGE);
    const limit = normalizePagination(req.query.limit, DEFAULT_LIMIT);

    const result = await listApprovedJobsPublic({ page, limit });

    res.status(200).json({
      data: result.data.map((job) => {
        // Parse skills from JSON string if needed
        let skills: string[] = [];
        if (Array.isArray(job.skills)) {
          skills = job.skills;
        } else if (typeof job.skills === 'string') {
          try {
            const parsed = JSON.parse(job.skills);
            skills = Array.isArray(parsed) ? parsed : [];
          } catch {
            skills = [];
          }
        }

        return {
          id: job.id,
          employerId: job.employerId,
          ...mapEmployerInfo(job),
          title: job.title,
          slug: job.slug,
          description: job.description,
          skills,
          salary: Number(job.salary),
          currency: job.currency,
          location: job.location,
          addressLine: job.addressLine,
          provinceCode: job.provinceCode,
          provinceName: job.provinceNameSnapshot,
          jobType: job.jobType,
          publishedAt: toISOString(job.publishedAt),
          createdAt: toISOString(job.createdAt)!,
          updatedAt: toISOString(job.updatedAt)!,
          images: job.jobimage.map((image) => ({
            id: image.id,
            filePath: image.filePath,
            slot: image.slot,
            createdAt: toISOString(image.createdAt)!,
          })),
        };
      }),
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

const ALLOWED_SORT = new Set(['publishedAt_desc', 'salary_desc', 'salary_asc']);
const MAX_QUERY_LENGTH = 120;

function parseJobType(value: unknown): job_jobType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'REMOTE'].includes(normalized)) {
    return normalized as job_jobType;
  }
  return undefined;
}

function parseSort(value: unknown): 'publishedAt_desc' | 'salary_desc' | 'salary_asc' {
  if (typeof value !== 'string') {
    return 'publishedAt_desc';
  }
  const normalized = value.trim();
  return ALLOWED_SORT.has(normalized as never) ? (normalized as 'publishedAt_desc' | 'salary_desc' | 'salary_asc') : 'publishedAt_desc';
}

function parseSalary(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export async function searchPublicJobsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const start = Date.now();
  try {
    const page = normalizePagination(req.query.page, DEFAULT_PAGE);
    const limit = normalizePagination(req.query.limit, 20, 1, 20);

    let q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    if (q) {
      if (q.length < 2) {
        throw new ValidationError('Query must be at least 2 characters long');
      }
      if (q.length > MAX_QUERY_LENGTH) {
        q = q.slice(0, MAX_QUERY_LENGTH);
      }
    }
    if (q && q.length < 2) {
      throw new ValidationError('Query must be at least 2 characters long');
    }

    const provinceCode = typeof req.query.provinceCode === 'string' ? req.query.provinceCode.trim() : undefined;

    const jobType = parseJobType(req.query.jobType);
    const salaryMin = parseSalary(req.query.salaryMin);
    const salaryMax = parseSalary(req.query.salaryMax);

    if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
      throw new ValidationError('salaryMin cannot exceed salaryMax');
    }

    const sort = parseSort(req.query.sort);

    const result = await searchApprovedJobsPublic({
      page,
      limit,
      q,
      provinceCode,
      jobType,
      salaryMin,
      salaryMax,
      sort,
    });

    const durationMs = Date.now() - start;
    recordSearchRequest('success');
    observeSearchLatency('success', durationMs / 1000);
    logger.info({
      event: 'job_search_request',
      durationMs,
      resultCount: result.data.length,
      page,
      limit,
      filtersApplied: result.filtersApplied,
    });

    res.status(200).json({
      data: result.data.map((job) => {
        // Parse skills from JSON string if needed
        let skills: string[] = [];
        if (Array.isArray(job.skills)) {
          skills = job.skills;
        } else if (typeof job.skills === 'string') {
          try {
            const parsed = JSON.parse(job.skills);
            skills = Array.isArray(parsed) ? parsed : [];
          } catch {
            skills = [];
          }
        }

        return {
          id: job.id,
          employerId: job.employerId,
          ...mapEmployerInfo(job),
          title: job.title,
          slug: job.slug,
          description: job.description,
          skills,
          salary: Number(job.salary),
          currency: job.currency,
          location: job.location,
          addressLine: job.addressLine,
          provinceCode: job.provinceCode,
          provinceName: job.provinceNameSnapshot,
          jobType: job.jobType,
          publishedAt: toISOString(job.publishedAt),
          createdAt: toISOString(job.createdAt)!,
          updatedAt: toISOString(job.updatedAt)!,
          images: job.jobimage.map((image) => ({
            id: image.id,
            filePath: image.filePath,
            slot: image.slot,
            createdAt: toISOString(image.createdAt)!,
          })),
        };
      }),
      pagination: result.pagination,
      filtersApplied: result.filtersApplied,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    recordSearchRequest('error');
    observeSearchLatency('error', durationMs / 1000);
    logger.error({
      event: 'job_search_request_failed',
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      query: {
        q: req.query.q,
        provinceCode: req.query.provinceCode,
        jobType: req.query.jobType,
      },
    });
    next(error);
  }
}
