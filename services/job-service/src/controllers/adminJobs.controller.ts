import type { NextFunction, Request, Response } from 'express';
import type { job_status } from '@prisma/client';
import { listJobsForAdmin, approveJob, rejectJob, deleteJob } from '../services/job.service';
import logger from '../utils/logger';
import { sendJobApprovedEmail, sendJobRejectedEmail } from '../infra/email/smtpMailer';
import { publishJobApprovedEvent, publishJobRejectedEvent } from '../events/jobEvents';
import { isServiceError } from '../utils/errors';
import { adminApproveSchema, adminRejectSchema } from '../schemas/job.schema';
import { ZodError } from 'zod';

type AdminJobResult = Awaited<ReturnType<typeof listJobsForAdmin>>;
type AdminJobItem = AdminJobResult['data'][number];

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

export async function listPendingJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number.parseInt(String(req.query.page ?? '1'), 10);
    const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const status = parseStatusFilter(req.query.status) ?? 'PENDING';

    const result: AdminJobResult = await listJobsForAdmin({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
      status,
    });

    res.status(200).json({
      data: result.data.map((job: AdminJobItem) => ({
        id: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        description: job.description,
        skills: job.skills,
        salary: Number(job.salary),
        currency: job.currency,
        status: job.status,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        location: job.location,
        addressLine: job.addressLine,
        provinceCode: job.provinceCode,
        provinceNameSnapshot: job.provinceNameSnapshot,        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
        approvalLogs: job.jobapprovallog.map((log) => ({
          id: log.id,
          action: log.action,
          performedBy: log.performedBy,
          note: log.note,
          createdAt: log.createdAt.toISOString(),
        })),
        images: job.jobimage.map((image) => ({
          id: image.id,
          filePath: '/' + image.filePath.replace(/\\/g, '/'),
          slot: image.slot,
        })),
        document: (job as any).document ? {
          id: (job as any).document.id,
          filePath: '/uploads/documents/' + (job as any).document.filePath.replace(/\\/g, '/'),
          originalName: (job as any).document.originalName,
          fileSize: (job as any).document.fileSize,
          createdAt: (job as any).document.createdAt.toISOString(),
        } : null,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({
      event: 'job_post_admin_list_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function approveJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Job ID is required',
      });
      return;
    }

    let note: string | undefined;
    try {
      ({ note } = adminApproveSchema.parse(req.body ?? {}));
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          code: 'ERR_VALIDATION',
          message: 'Dữ liệu không hợp lệ',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      throw error;
    }

    const job = await approveJob({
      jobId,
      actorId: currentUser.id,
      note,
    });

    if (job.employerEmail) {
      try {
        await sendJobApprovedEmail({
          to: job.employerEmail,
          jobTitle: job.title,
          jobId: job.id,
          slug: job.slug,
        });
      } catch (emailError) {
        logger.warn({
          event: 'job_post_admin_approval_email_failed',
          jobId: job.id,
          employerEmail: job.employerEmail,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    } else {
      logger.warn({
        event: 'job_post_admin_approval_missing_email',
        jobId: job.id,
        employerId: job.employerId,
      });
    }

    try {
      await publishJobApprovedEvent({
        jobId: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        approvedBy: currentUser.id,
        approvedAt: job.publishedAt?.toISOString() ?? new Date().toISOString(),
      });
    } catch (eventError) {
      logger.warn({
        event: 'job_post_admin_approval_event_failed',
        jobId: job.id,
        error: eventError instanceof Error ? eventError.message : String(eventError),
      });
    }

    res.status(200).json({
      data: {
        id: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        status: job.status,
        jobType: job.jobType,
        location: job.location,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
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
      event: 'job_post_admin_approval_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function rejectJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Job ID is required',
      });
      return;
    }

    let note: string;
    try {
      ({ note } = adminRejectSchema.parse(req.body ?? {}));
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          code: 'ERR_VALIDATION',
          message: 'Dữ liệu không hợp lệ',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      throw error;
    }

    const job = await rejectJob({
      jobId,
      actorId: currentUser.id,
      note,
    });

    if (job.employerEmail) {
      try {
        await sendJobRejectedEmail({
          to: job.employerEmail,
          jobTitle: job.title,
          jobId: job.id,
          slug: job.slug,
          note,
        });
      } catch (emailError) {
        logger.warn({
          event: 'job_post_admin_rejection_email_failed',
          jobId: job.id,
          employerEmail: job.employerEmail,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    } else {
      logger.warn({
        event: 'job_post_admin_rejection_missing_email',
        jobId: job.id,
        employerId: job.employerId,
      });
    }

    try {
      await publishJobRejectedEvent({
        jobId: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        rejectedBy: currentUser.id,
        rejectedAt: new Date().toISOString(),
        reason: note,
      });
    } catch (eventError) {
      logger.warn({
        event: 'job_post_admin_rejection_event_failed',
        jobId: job.id,
        error: eventError instanceof Error ? eventError.message : String(eventError),
      });
    }

    res.status(200).json({
      data: {
        id: job.id,
        employerId: job.employerId,
        title: job.title,
        slug: job.slug,
        status: job.status,
        jobType: job.jobType,
        location: job.location,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
        rejectionNote: note,
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
      event: 'job_post_admin_rejection_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function deleteJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.id) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    const jobId = req.params.jobId;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Job ID is required',
      });
      return;
    }

    // Validate deletion reason
    let reason: string;
    try {
      const { z } = await import('zod');
      const deleteSchema = z.object({
        reason: z
          .string({ required_error: 'Lý do xóa là bắt buộc' })
          .trim()
          .min(10, 'Lý do xóa phải có ít nhất 10 ký tự')
          .max(500, 'Lý do xóa không được vượt quá 500 ký tự'),
      });
      ({ reason } = deleteSchema.parse(req.body ?? {}));
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          code: 'ERR_VALIDATION',
          message: 'Dữ liệu không hợp lệ',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      throw error;
    }

    // Admin can delete any job, so we get the job first to find employerId
    const { getPrismaClient } = await import('../infra/prisma/prismaClient');
    const prisma = getPrismaClient();
    
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { 
        id: true, 
        employerId: true, 
        status: true,
        title: true,
        employerEmail: true,
      },
    });

    if (!job) {
      res.status(404).json({
        code: 'ERR_NOT_FOUND',
        message: 'Job not found',
      });
      return;
    }

    if (job.status === 'DELETED') {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Job is already deleted',
      });
      return;
    }

    if (job.status === 'PENDING' || job.status === 'REJECTED') {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Cannot delete job with PENDING or REJECTED status. Please approve or reject first.',
      });
      return;
    }

    await deleteJob({
      employerId: job.employerId,
      actorId: currentUser.id,
      jobId,
    });

    logger.info({
      event: 'job_post_admin_deleted',
      adminId: currentUser.id,
      jobId,
      employerId: job.employerId,
      reason,
    });

    // Send email notification to employer
    if (job.employerEmail) {
      try {
        logger.info({
          event: 'job_post_admin_delete_sending_email',
          jobId: job.id,
          employerEmail: job.employerEmail,
          reason,
        });
        
        const { sendJobDeletedByAdminEmail } = await import('../infra/email/smtpMailer');
        await sendJobDeletedByAdminEmail({
          to: job.employerEmail,
          jobTitle: job.title,
          jobId: job.id,
          reason,
        });
        
        logger.info({
          event: 'job_post_admin_delete_email_sent',
          jobId: job.id,
          employerEmail: job.employerEmail,
        });
      } catch (emailError) {
        logger.error({
          event: 'job_post_admin_delete_email_failed',
          jobId: job.id,
          employerEmail: job.employerEmail,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
      }
    } else {
      logger.warn({
        event: 'job_post_admin_delete_missing_email',
        jobId: job.id,
        employerId: job.employerId,
      });
    }

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
      event: 'job_post_admin_delete_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
