import type { NextFunction, Request, Response } from 'express';
import { CvReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { CVStorageService } from '../services/cv/cvStorageService';
import { loadAppConfig } from '../config/appConfig';
import { publishCvDecisionEvent } from '../events/jobEvents';
import { sendCandidateCvDecisionEmail } from '../infra/email/smtpMailer';
import logger from '../utils/logger';
import { parseJsonObject } from '../utils/json';

const prisma = getPrismaClient();
const cvStorage = new CVStorageService(loadAppConfig().storage.cv);

interface EmployerRequest extends Request {
  user?: {
    id?: string;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listEmployerApplicationsHandler(
  req: EmployerRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string' || jobId.length === 0) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'jobId parameter is required',
      });
      return;
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { employerId: true },
    });

    if (!job) {
      res.status(404).json({
        code: 'ERR_JOB_NOT_FOUND',
        message: 'Job not found or access denied',
      });
      return;
    }
    if (job.employerId !== currentUser.id) {
      res.status(403).json({
        code: 'ERR_FORBIDDEN',
        message: 'You are not allowed to view applications for this job',
      });
      return;
    }

    const page = clampInt(parseInt(String(req.query.page ?? DEFAULT_PAGE), 10), DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);
    const limit = clampInt(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10), 1, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const cvStatusFilter = parseCvStatusFilter(req.query.cv_status);

    const whereClause: Parameters<typeof prisma.application.findMany>[0]['where'] = {
      jobId,
    };

    if (cvStatusFilter) {
      whereClause.cvStatus = cvStatusFilter;
    }

    const [applications, total] = await prisma.$transaction([
      prisma.application.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          candidateId: true,
          status: true,
          cvStatus: true,
          cvDecisionNote: true,
          cvReviewedAt: true,
          cvSnapshot: true,
          createdAt: true,
          candidate: {
            select: {
              email: true,
              fullName: true,
              phoneNumber: true,
              preferredProvinceCode: true,
              preferredAddressLine: true,
            },
          },
        },
      }),
      prisma.application.count({ where: whereClause }),
    ]);

    const candidateIds = [...new Set(applications.map((app) => app.candidateId))];
    const candidateCvRecords = candidateIds.length
      ? await prisma.candidateCv.findMany({
          where: { 
            candidateId: { in: candidateIds },
            status: 'PARSED', // Only get successfully parsed CVs
          },
          orderBy: [{ candidateId: 'asc' }, { uploadedAt: 'desc' }],
          select: {
            candidateId: true,
            filePath: true,
          },
        })
      : [];

    const latestCvByCandidate = new Map<string, string>();
    for (const record of candidateCvRecords) {
      if (!latestCvByCandidate.has(record.candidateId)) {
        latestCvByCandidate.set(record.candidateId, record.filePath);
      }
    }

    // Get candidate names from auth service
    const candidateNames = new Map<string, string>();
    if (candidateIds.length > 0) {
      try {
        const authApiUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
        const response = await fetch(`${authApiUrl}/internal/users/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': process.env.INTERNAL_API_SECRET || 'dev-internal-secret',
          },
          body: JSON.stringify({ userIds: candidateIds }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            data.data.forEach((user: any) => {
              candidateNames.set(user.id, user.fullName || user.email);
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch candidate names:', error);
      }
    }

    const items = applications.map((application) => {
      const filePath = latestCvByCandidate.get(application.candidateId);
      const signedUrl = filePath ? cvStorage.generateSignedUrl(filePath) : null;
      const downloadUrl = signedUrl ? `/cv/download?token=${signedUrl.token}` : null;
      const cvSnapshot = parseJsonObject(application.cvSnapshot);

      // Log for debugging
      if (!downloadUrl) {
        logger.debug({
          event: 'cv_download_url_missing',
          candidateId: application.candidateId,
          hasFilePath: !!filePath,
          hasSignedUrl: !!signedUrl,
        });
      }

      return {
        id: application.id,
        candidateId: application.candidateId,
        candidateName: candidateNames.get(application.candidateId) || application.candidate?.fullName || application.candidateId,
        candidateEmail: application.candidate?.email,
        candidatePhone: application.candidate?.phoneNumber,
        candidateAddress: application.candidate?.preferredAddressLine,
        candidateProvinceCode: application.candidate?.preferredProvinceCode,
        status: application.status,
        cvStatus: application.cvStatus,
        cvDecisionNote: application.cvDecisionNote,
        cvReviewedAt: application.cvReviewedAt,
        cvSnapshot: cvSnapshot,
        createdAt: application.createdAt,
        cvDownloadUrl: downloadUrl,
        cvDownloadUrlExpiresAt: signedUrl ? signedUrl.expiresAt : null,
      };
    });

    res.status(200).json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function decideEmployerApplicationHandler(
  req: EmployerRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const { jobId, applicationId } = req.params;
    if (!jobId || !applicationId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'jobId and applicationId are required',
      });
      return;
    }

    const validation = decisionSchema.safeParse(req.body ?? {});
    if (!validation.success) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        details: validation.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { employerId: true, title: true },
    });

    if (!job) {
      res.status(404).json({
        code: 'ERR_JOB_NOT_FOUND',
        message: 'Job not found or access denied',
      });
      return;
    }
    if (job.employerId !== currentUser.id) {
      res.status(403).json({
        code: 'ERR_FORBIDDEN',
        message: 'You are not allowed to review applications for this job',
      });
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, jobId },
      select: {
        id: true,
        candidateId: true,
        cvStatus: true,
        job: {
          select: {
            title: true,
          },
        },
        candidate: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({
        code: 'ERR_APPLICATION_NOT_FOUND',
        message: 'Application not found',
      });
      return;
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        cvStatus: validation.data.cvStatus,
        cvDecisionNote: validation.data.note ?? null,
        cvReviewedAt: new Date(),
      },
    });

    try {
      publishCvDecisionEvent({
        applicationId: updated.id,
        jobId,
        candidateId: application.candidateId,
        status: updated.cvStatus ?? 'PENDING',
        note: updated.cvDecisionNote ?? undefined,
        decidedAt: updated.cvReviewedAt?.toISOString() ?? new Date().toISOString(),
      });
    } catch (eventError) {
      console.warn('[Applications] Failed to publish cv decision event', eventError);
    }

    // Send email notification to candidate
    if (application.candidate?.email && application.job?.title) {
      logger.info({
        event: 'sending_cv_decision_email',
        applicationId,
        candidateEmail: application.candidate.email,
        jobTitle: application.job.title,
        decision: validation.data.cvStatus,
      });

      sendCandidateCvDecisionEmail({
        to: application.candidate.email,
        candidateName: application.candidate.fullName ?? undefined,
        jobTitle: application.job.title,
        status: validation.data.cvStatus,
        note: validation.data.note,
      }).catch((emailError) => {
        logger.warn({
          event: 'candidate_cv_decision_email_failed',
          applicationId,
          candidateId: application.candidateId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      });
    } else {
      logger.warn({
        event: 'cv_decision_email_skipped',
        applicationId,
        reason: !application.candidate?.email ? 'no_candidate_email' : 'no_job_title',
        candidateEmail: application.candidate?.email,
        jobTitle: application.job?.title,
      });
    }

    res.status(200).json({
      data: {
        id: updated.id,
        jobId,
        candidateId: application.candidateId,
        cvStatus: updated.cvStatus,
        cvDecisionNote: updated.cvDecisionNote,
        cvReviewedAt: updated.cvReviewedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function parseCvStatusFilter(input: unknown): CvReviewStatus | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }
  const normalized = input.trim().toUpperCase();
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(normalized)) {
    return normalized as CvReviewStatus;
  }
  return undefined;
}
const decisionSchema = z
  .object({
    cvStatus: z.enum(['APPROVED', 'REJECTED']),
    note: z
      .string()
      .trim()
      .max(1000, 'Note must be at most 1000 characters')
      .optional(),
  })
  .refine(
    (data) => {
      // If REJECTED, note is required and must be at least 10 characters
      if (data.cvStatus === 'REJECTED') {
        return data.note && data.note.length >= 10;
      }
      return true;
    },
    {
      message: 'Note is required and must be at least 10 characters when rejecting CV',
      path: ['note'],
    }
  );
