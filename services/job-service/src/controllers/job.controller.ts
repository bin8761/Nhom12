import type { NextFunction, Request, Response } from 'express';
import {
  jobCreateSchema,
  normalizeJobCreatePayload,
  jobUpdateSchema,
  normalizeJobUpdatePayload,
  parseRemoveImageIds,
} from '../schemas/job.schema';
import {
  createJobWithImages,
  getEmployerJobDetails,
  listEmployerJobs,
  updateJobWithImages,
  deleteJob,
} from '../services/job.service';
import type { job_status } from '@prisma/client';
import { isServiceError } from '../utils/errors';
import logger from '../utils/logger';
import { observeJobUpdateDuration } from '../metrics/jobMetrics';

interface RequestUser {
  id?: string;
  email?: string;
  role?: string;
  approvalStatus?: string;
}

interface JobRequest extends Request {
  user?: RequestUser;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

const VALIDATION_ERROR = {
  code: 'ERR_VALIDATION',
  message: 'Dữ liệu không hợp lệ',
};

const MAX_IMAGES = 5;

function parseSkills(skills: unknown): string[] {
  if (typeof skills === 'string') {
    try {
      const parsed = JSON.parse(skills);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(skills) ? skills : [];
}

function buildJobResponse(result: Awaited<ReturnType<typeof createJobWithImages>>) {
  return {
    id: result.job.id,
    employerId: result.job.employerId,
    title: result.job.title,
    slug: result.job.slug,
    description: result.job.description,
    skills: Array.isArray(result.job.skills) ? result.job.skills : [],
    salary: Number(result.job.salary),
    currency: result.job.currency,
    location: result.job.location,
    jobType: result.job.jobType,
    experienceLevel: result.job.experienceLevel,
    provinceCode: result.job.provinceCode,
    provinceName: result.job.provinceNameSnapshot,
    addressLine: result.job.addressLine,
    status: result.job.status,
    publishedAt: result.job.publishedAt ? result.job.publishedAt.toISOString() : null,
    createdAt: result.job.createdAt.toISOString(),
    updatedAt: result.job.updatedAt.toISOString(),
    images: result.images
      .sort((a, b) => a.slot - b.slot)
      .map((image) => ({
        id: image.id,
        filePath: '/' + image.filePath.replace(/\\/g, '/').replace(/^storage\//, 'storage/'),
        slot: image.slot,
        createdAt: image.createdAt.toISOString(),
      })),
    document: result.document ? {
      id: result.document.id,
      filePath: '/uploads/documents/' + result.document.filePath.replace(/\\/g, '/'),
      originalName: result.document.originalName,
      fileSize: result.document.fileSize,
      mimeType: result.document.mimeType,
      createdAt: result.document.createdAt.toISOString(),
    } : null,
  };
}

function parseStatusFilter(value: unknown): job_status | 'ALL' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'ALL') {
    return 'ALL';
  }

  if (['PENDING', 'APPROVED', 'REJECTED', 'DELETED'].includes(normalized)) {
    return normalized as job_status;
  }

  return undefined;
}

export async function createJobHandler(req: JobRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const normalized = normalizeJobCreatePayload(req.body ?? {});
    
    // Extract files from multer.fields()
    const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFiles = filesObj?.images || [];
    const documentFiles = filesObj?.document || [];
    
    logger.debug({
      event: 'job_post_payload',
      payload: normalized,
      imageFiles: imageFiles.map((file) => file.originalname),
      documentFiles: documentFiles.map((file) => file.originalname),
    });
    
    const parsed = await jobCreateSchema.safeParseAsync(normalized);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        ...VALIDATION_ERROR,
        details,
      });
      return;
    }

    if (imageFiles.length > MAX_IMAGES) {
      res.status(400).json({
        ...VALIDATION_ERROR,
        details: [{ path: 'images', message: 'A maximum of 5 images is allowed' }],
      });
      return;
    }

    const images = imageFiles.map((file) => ({
      originalName: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    }));

    const document = documentFiles.length > 0 ? {
      originalName: documentFiles[0].originalname,
      buffer: documentFiles[0].buffer,
      mimetype: documentFiles[0].mimetype,
      size: documentFiles[0].size,
    } : undefined;

    const result = await createJobWithImages({
      employerId: currentUser.id,
      actorId: currentUser.id,
      employerEmail: currentUser.email ?? null,
      payload: parsed.data,
      images,
      document,
    });

    res.status(201).json({ data: buildJobResponse(result) });
    logger.info({
      event: 'job_post_created',
      jobId: result.job.id,
      employerId: currentUser.id,
      imagesCount: result.images.length,
      hasDocument: !!result.document,
    });
  } catch (error) {
    logger.error({
      event: 'job_post_create_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function listJobsHandler(req: JobRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const page = Number.parseInt(String(req.query.page ?? '1'), 10);
    const limit = Number.parseInt(String(req.query.limit ?? '10'), 10);
    const status = parseStatusFilter(req.query.status);

    const result = await listEmployerJobs({
      employerId: currentUser.id,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 10,
      status,
    });

    res.status(200).json({
      data: result.data.map((job) => ({
        id: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        description: job.description,
        skills: parseSkills(job.skills),
        salary: Number(job.salary),
        currency: job.currency,
        location: job.location,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        provinceCode: job.provinceCode,
        provinceName: job.provinceNameSnapshot,
        addressLine: job.addressLine,
        status: job.status,
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        images: job.jobimage.map((image) => ({
          id: image.id,
          filePath: '/' + image.filePath.replace(/\\/g, '/').replace(/^storage\//, 'storage/'),
          slot: image.slot,
          createdAt: image.createdAt.toISOString(),
        })),
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({
      event: 'job_post_list_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function getJobDetailHandler(req: JobRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({
        ...VALIDATION_ERROR,
        details: [{ path: 'jobId', message: 'Job ID is required' }],
      });
      return;
    }

    const job = await getEmployerJobDetails({
      employerId: currentUser.id,
      jobId,
    });

    res.status(200).json({
      data: {
        id: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        description: job.description,
        skills: parseSkills(job.skills),
        salary: Number(job.salary),
        currency: job.currency,
        location: job.location,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        provinceCode: job.provinceCode,
        provinceName: job.provinceNameSnapshot,
        addressLine: job.addressLine,
        status: job.status,
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        images: job.jobimage.map((image) => ({
          id: image.id,
          filePath: '/' + image.filePath.replace(/\\/g, '/').replace(/^storage\//, 'storage/'),
          slot: image.slot,
          createdAt: image.createdAt.toISOString(),
        })),
        document: job.document ? {
          id: job.document.id,
          filePath: '/uploads/documents/' + job.document.filePath.replace(/\\/g, '/'),
          originalName: job.document.originalName,
          fileSize: job.document.fileSize,
          createdAt: job.document.createdAt.toISOString(),
        } : null,
        approvalLogs: job.jobapprovallog.map((log) => ({
          id: log.id,
          action: log.action,
          performedBy: log.performedBy,
          note: log.note,
          createdAt: log.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    logger.error({
      event: 'job_post_detail_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function updateJobHandler(req: JobRequest, res: Response, next: NextFunction): Promise<void> {
  const start = Date.now();
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({
        ...VALIDATION_ERROR,
        details: [{ path: 'jobId', message: 'Job ID is required' }],
      });
      return;
    }

    const normalized = normalizeJobUpdatePayload(req.body ?? {});
    const parsed = await jobUpdateSchema.safeParseAsync(normalized);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        ...VALIDATION_ERROR,
        details,
      });
      return;
    }

    const removeImageIds = parseRemoveImageIds(req.body?.removeImageIds);
    const removeDocument = req.body?.removeDocument === 'true' || req.body?.removeDocument === true;
    
    // Extract files from multer.fields()
    const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFiles = filesObj?.images || [];
    const documentFiles = filesObj?.document || [];

    if (Object.keys(parsed.data).length === 0 && imageFiles.length === 0 && documentFiles.length === 0 && removeImageIds.length === 0 && !removeDocument) {
      res.status(400).json({
        ...VALIDATION_ERROR,
        details: [{ path: 'body', message: 'No updates were provided' }],
      });
      return;
    }

    const newImages = imageFiles.map((file) => ({
      originalName: file.originalname,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    }));

    const newDocument = documentFiles.length > 0 ? {
      originalName: documentFiles[0].originalname,
      buffer: documentFiles[0].buffer,
      mimetype: documentFiles[0].mimetype,
      size: documentFiles[0].size,
    } : undefined;

    const result = await updateJobWithImages({
      employerId: currentUser.id,
      actorId: currentUser.id,
      jobId,
      payload: parsed.data,
      newImages,
      removeImageIds,
      newDocument,
      removeDocument,
    });

    const durationSeconds = (Date.now() - start) / 1000;
    observeJobUpdateDuration('success', durationSeconds);
    res.status(200).json({ data: buildJobResponse(result) });
    logger.info({
      event: 'job_post_updated',
      jobId: result.job.id,
      employerId: currentUser.id,
      imagesCount: result.images.length,
      removedImages: removeImageIds.length,
      addedImages: newImages.length,
      hasDocument: !!result.document,
      removedDocument: removeDocument,
    });

    // Send notification emails asynchronously (don't wait)
    (async () => {
      try {
        const { sendJobUpdatePendingEmail, sendJobUnavailableEmail } = await import('../infra/email/smtpMailer');
        const { getPrismaClient } = await import('../infra/prisma/prismaClient');
        const prisma = getPrismaClient();

        // Send email to employer
        if (result.job.employerEmail) {
          await sendJobUpdatePendingEmail({
            to: result.job.employerEmail,
            jobTitle: result.job.title,
            jobId: result.job.id,
          });
        }

        // Get all candidates who applied to this job
        const applications = await prisma.application.findMany({
          where: {
            jobId: result.job.id,
            status: { not: 'WITHDRAWN' },
          },
          include: {
            candidate: true,
          },
        });

        // Send email to all candidates
        for (const app of applications) {
          if (app.candidate?.email) {
            await sendJobUnavailableEmail({
              to: app.candidate.email,
              candidateName: app.candidate.fullName || undefined,
              jobTitle: result.job.title,
            });
          }
        }

        logger.info({
          event: 'job_update_notifications_sent',
          jobId: result.job.id,
          candidatesNotified: applications.length,
        });
      } catch (error) {
        logger.error({
          event: 'job_update_notifications_failed',
          jobId: result.job.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    const durationSeconds = (Date.now() - start) / 1000;
    observeJobUpdateDuration('error', durationSeconds);
    logger.error({
      event: 'job_post_update_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function deleteJobHandler(req: JobRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({
        ...VALIDATION_ERROR,
        details: [{ path: 'jobId', message: 'Job ID is required' }],
      });
      return;
    }

    await deleteJob({
      employerId: currentUser.id,
      actorId: currentUser.id,
      jobId,
    });

    res.status(204).send();
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    logger.error({
      event: 'job_post_delete_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}


