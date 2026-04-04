import {
  Prisma,
  job,
  jobimage,
  jobapprovallog_action,
  jobapprovallog,
  job_status,
  job_jobType,
  JobDocument,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import {
  appendSlugDiscriminator,
  generateSlugBase,
} from '../utils/slug.util';
import { ImageStorageService } from './image-storage.service';
import { DocumentStorageService } from './document-storage.service';
import { getJobApprovalQueueContext } from '../container/appContext';
import type { JobCreateRequestInput, JobUpdateRequestInput } from '../schemas/job.schema';
import { NotFoundError } from '../utils/errors';
import { ValidationError } from '../utils/errors';
import { appendJobLog } from './audit-log.service';
import { publishJobCreatedEvent, publishJobApprovedEvent, publishJobRejectedEvent } from '../events/jobEvents';
import { sendJobDeletedNotificationEmail } from '../infra/email/smtpMailer';
import logger from '../utils/logger';
import { getRedisConnection } from '../container/appContext';
import { loadAppConfig } from '../config/appConfig';
import { recordSearchCache } from '../metrics/jobMetrics';
import { ensureLocationSnapshot, LocationSnapshot } from './locationValidation.service';

const prisma = getPrismaClient();
const imageStorage = new ImageStorageService();
const documentStorage = new DocumentStorageService();

/**
 * Fetch employer profiles from auth-service using batch internal API
 */
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

    logger.info({
      event: 'fetch_employer_profiles_success',
      employerCount: employerIds.length,
      foundCount: employerMap.size,
    });

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

/**
 * Helper function to send job deleted notifications to candidates
 */
async function sendJobDeletedNotifications(
  jobTitle: string,
  applications: Array<{
    candidate: {
      email: string;
      fullName: string | null;
    } | null;
  }>,
): Promise<void> {
  const emailPromises = applications
    .filter(app => app.candidate?.email)
    .map(app =>
      sendJobDeletedNotificationEmail({
        to: app.candidate!.email,
        candidateName: app.candidate!.fullName || undefined,
        jobTitle,
      }).catch(error => {
        logger.warn({
          event: 'candidate_job_deleted_email_failed',
          candidateEmail: app.candidate!.email,
          jobTitle,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );

  await Promise.allSettled(emailPromises);

  logger.info({
    event: 'job_deleted_notifications_sent',
    jobTitle,
    recipientCount: emailPromises.length,
  });
}

export interface UploadedJobImage {
  originalName: string;
  buffer: Buffer;
  mimetype?: string;
  size?: number;
}

export interface UploadedJobDocument {
  originalName: string;
  buffer: Buffer;
  mimetype?: string;
  size?: number;
}

export interface CreateJobParams {
  employerId: string;
  actorId: string;
  payload: JobCreateRequestInput;
  images: UploadedJobImage[];
  document?: UploadedJobDocument;
  employerEmail?: string | null;
}

export interface CreateJobResult {
  job: job;
  images: jobimage[];
  document: any | null;
}

export interface ListJobsParams {
  employerId: string;
  status?: job_status | 'ALL';
  page: number;
  limit: number;
}

export interface ListJobsResult {
  data: Array<
    job & {
      jobimage: jobimage[];
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobDetailsParams {
  employerId: string;
  jobId: string;
}

export interface UpdateJobParams {
  employerId: string;
  actorId: string;
  jobId: string;
  payload: JobUpdateRequestInput;
  newImages: UploadedJobImage[];
  removeImageIds: string[];
  newDocument?: UploadedJobDocument;
  removeDocument?: boolean;
}

export interface DeleteJobParams {
  employerId: string;
  actorId: string;
  jobId: string;
}

export interface RestoreJobParams {
  employerId: string;
  actorId: string;
  jobId: string;
}

export interface AdminListJobsParams {
  status?: job_status | 'ALL';
  page: number;
  limit: number;
}

export interface PublicListJobsParams {
  page: number;
  limit: number;
}

export interface PublicListJobsResult {
  data: Array<
    job & {
      jobimage: jobimage[];
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApproveJobParams {
  jobId: string;
  actorId: string;
  note?: string;
}

export interface RejectJobParams {
  jobId: string;
  actorId: string;
  note: string;
}

async function createJobEntity(
  tx: Prisma.TransactionClient,
  employerId: string,
  employerEmail: string | null | undefined,
  payload: JobCreateRequestInput,
): Promise<job> {
  const locationSnapshot = await ensureLocationSnapshot(tx, payload.provinceCode);
  const baseSlug = generateSlugBase({ base: payload.title });
  let slugCandidate = baseSlug || appendSlugDiscriminator('job');
  let attempt = 0;

  while (attempt <= 5) {
    try {
      const jobId = crypto.randomUUID();
      const now = new Date();
      return await tx.job.create({
        data: {
          id: jobId,
          employerId,
          employerEmail,
          title: payload.title,
          slug: slugCandidate,
          description: payload.description,
          skills: JSON.stringify(payload.skills),
          salary: new Prisma.Decimal(payload.salary),
          currency: payload.currency,
          location: payload.location,
          provinceCode: locationSnapshot.provinceCode,
          provinceNameSnapshot: locationSnapshot.provinceName,
          addressLine: payload.addressLine,
          jobType: payload.jobType,
          experienceLevel: payload.experienceLevel as any,
          status: 'PENDING',
          updatedAt: now,
        },
      });
    } catch (error) {
      const isSlugConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (
          (Array.isArray(error.meta?.target) &&
            error.meta?.target.includes('employerId') &&
            error.meta?.target.includes('slug')) ||
          error.meta?.target === 'Job_employerId_slug_key'
        );

      if (isSlugConflict) {
        slugCandidate = appendSlugDiscriminator(baseSlug);
        attempt += 1;
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to generate unique job slug for employer');
}

export async function createJobWithImages(params: CreateJobParams): Promise<CreateJobResult> {
  const filesToCleanup: Array<{ jobId: string; relativePath: string; type: 'image' | 'document' }> = [];

  try {
    const result = await prisma.$transaction<CreateJobResult>(async (tx) => {
      const job = await createJobEntity(tx, params.employerId, params.employerEmail, params.payload);

      const imageRecords: jobimage[] = [];

      for (const [index, file] of params.images.entries()) {
        imageStorage.validateFile(file.mimetype, file.size ?? 0);
        const relativePath = await imageStorage.save(job.id, file.originalName, file.buffer);
        filesToCleanup.push({ jobId: job.id, relativePath, type: 'image' });

        const imageRecord = await tx.jobimage.create({
          data: {
            id: randomUUID(),
            jobId: job.id,
            filePath: relativePath,
            slot: index,
          },
        });

        imageRecords.push(imageRecord);
      }

      let documentRecord = null;
      if (params.document) {
        documentStorage.validateFile(params.document.mimetype, params.document.size ?? 0);
        const relativePath = await documentStorage.save(job.id, params.document.originalName, params.document.buffer);
        filesToCleanup.push({ jobId: job.id, relativePath, type: 'document' });

        documentRecord = await tx.jobDocument.create({
          data: {
            jobId: job.id,
            filePath: relativePath,
            originalName: params.document.originalName,
            fileSize: params.document.size ?? 0,
            mimeType: params.document.mimetype ?? 'application/pdf',
          },
        });
      }

      await appendJobLog({
        jobId: job.id,
        action: jobapprovallog_action.SUBMITTED,
        performedBy: params.actorId,
        tx,
      });

      return { job, images: imageRecords, document: documentRecord };
    });

    const queue = getJobApprovalQueueContext();
    await queue.add('job.submitted', {
      jobId: result.job.id,
      employerId: params.employerId,
      employerEmail: params.employerEmail ?? null,
      title: result.job.title,
      slug: result.job.slug,
      source: 'create',
      submittedAt: new Date().toISOString(),
    });
    publishJobCreatedEvent({
      jobId: result.job.id,
      employerId: params.employerId,
      title: result.job.title,
      slug: result.job.slug,
      createdAt: result.job.createdAt.toISOString(),
    });
    const redis = getRedisConnection();
    await redis.set(SEARCH_FRESHNESS_KEY, result.job.updatedAt.toISOString()).catch(() => null);

    return result;
  } catch (error) {
    await Promise.allSettled(
      filesToCleanup.map((file) =>
        file.type === 'image'
          ? imageStorage.delete(file.jobId, file.relativePath)
          : documentStorage.delete(file.jobId, file.relativePath)
      ),
    );
    throw error;
  }
}

export async function listEmployerJobs(params: ListJobsParams): Promise<ListJobsResult> {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 50);
  const skip = (page - 1) * limit;

  const where: Prisma.jobWhereInput = {
    employerId: params.employerId,
  };

  if (params.status && params.status !== 'ALL') {
    where.status = params.status;
  }

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        jobimage: {
          orderBy: { slot: 'asc' },
        },
        document: true,
      },
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data: jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function getEmployerJobDetails(params: JobDetailsParams) {
  const job = await prisma.job.findFirst({
    where: {
      id: params.jobId,
      employerId: params.employerId,
    },
    include: {
      jobimage: {
        orderBy: { slot: 'asc' },
      },
      document: true,
      jobapprovallog: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  return job;
}

export async function updateJobWithImages(params: UpdateJobParams): Promise<CreateJobResult> {
  const existingJob = await prisma.job.findFirst({
    where: {
      id: params.jobId,
      employerId: params.employerId,
    },
    include: {
      jobimage: true,
      document: true,
    },
  });

  if (!existingJob) {
    throw new NotFoundError('Job not found');
  }

  const removeSet = new Set(params.removeImageIds);
  const imagesToRemove = existingJob.jobimage.filter((image) => removeSet.has(image.id));

  if (params.removeImageIds.length !== imagesToRemove.length) {
    throw new NotFoundError('One or more images to remove were not found');
  }

  const remainingImages = existingJob.jobimage.filter((image) => !removeSet.has(image.id));
  if (remainingImages.length + params.newImages.length > 5) {
    throw new ValidationError('A maximum of 5 images is allowed per job');
  }

  const savedNewImages: Array<{ relativePath: string }> = [];
  let savedNewDocument: { relativePath: string; originalName: string; size: number; mimeType: string } | null = null;

  try {
    for (const file of params.newImages) {
      imageStorage.validateFile(file.mimetype, file.size ?? 0);
      const relativePath = await imageStorage.save(existingJob.id, file.originalName, file.buffer);
      savedNewImages.push({ relativePath });
    }

    if (params.newDocument) {
      documentStorage.validateFile(params.newDocument.mimetype, params.newDocument.size ?? 0);
      const relativePath = await documentStorage.save(existingJob.id, params.newDocument.originalName, params.newDocument.buffer);
      savedNewDocument = {
        relativePath,
        originalName: params.newDocument.originalName,
        size: params.newDocument.size ?? 0,
        mimeType: params.newDocument.mimetype ?? 'application/pdf',
      };
    }

    const result = await prisma.$transaction<CreateJobResult>(async (tx) => {
      const jobUpdateData: Prisma.jobUpdateInput = {
        status: 'PENDING',
        publishedAt: null,
      };
      let locationSnapshot: LocationSnapshot | null = null;
      if (params.payload.provinceCode !== undefined) {
        locationSnapshot = await ensureLocationSnapshot(tx, params.payload.provinceCode);
      }

      if (params.payload.title !== undefined) {
        jobUpdateData.title = params.payload.title;
      }
      if (params.payload.description !== undefined) {
        jobUpdateData.description = params.payload.description;
      }
      if (params.payload.skills !== undefined) {
        jobUpdateData.skills = JSON.stringify(params.payload.skills);
      }
      if (params.payload.salary !== undefined) {
        jobUpdateData.salary = new Prisma.Decimal(params.payload.salary);
      }
      if (params.payload.currency !== undefined) {
        jobUpdateData.currency = params.payload.currency;
      }
      if (params.payload.location !== undefined) {
        jobUpdateData.location = params.payload.location;
      }
      if (params.payload.jobType !== undefined) {
        jobUpdateData.jobType = params.payload.jobType;
      }
      if (params.payload.experienceLevel !== undefined) {
        jobUpdateData.experienceLevel = params.payload.experienceLevel;
      }
      if (params.payload.addressLine !== undefined) {
        jobUpdateData.addressLine = params.payload.addressLine;
      }
      if (locationSnapshot) {
        // Province is updated via relation
        jobUpdateData.province = {
          connect: { code: params.payload.provinceCode },
        };
        jobUpdateData.provinceNameSnapshot = locationSnapshot.provinceName;
      }

      const job = await tx.job.update({
        where: { id: existingJob.id },
        data: jobUpdateData,
      });

      if (imagesToRemove.length > 0) {
        await tx.jobimage.deleteMany({
          where: {
            jobId: existingJob.id,
            id: { in: params.removeImageIds },
          },
        });
      }

      const remaining = await tx.jobimage.findMany({
        where: { jobId: existingJob.id },
        orderBy: { slot: 'asc' },
      });

      for (const [index, image] of remaining.entries()) {
        if (image.slot !== index) {
          await tx.jobimage.update({
            where: { id: image.id },
            data: { slot: index },
          });
        }
      }

      const currentCount = remaining.length;

      for (const [index, file] of savedNewImages.entries()) {
        await tx.jobimage.create({
          data: {
            id: randomUUID(),
            jobId: existingJob.id,
            filePath: file.relativePath,
            slot: currentCount + index,
          },
        });
      }

      // Handle document
      let documentRecord = existingJob.document;

      if (params.removeDocument && existingJob.document) {
        await tx.jobDocument.delete({
          where: { jobId: existingJob.id },
        });
        documentRecord = null;
      }

      if (savedNewDocument) {
        // Delete old document if exists
        if (existingJob.document) {
          await tx.jobDocument.delete({
            where: { jobId: existingJob.id },
          });
        }

        documentRecord = await tx.jobDocument.create({
          data: {
            jobId: existingJob.id,
            filePath: savedNewDocument.relativePath,
            originalName: savedNewDocument.originalName,
            fileSize: savedNewDocument.size,
            mimeType: savedNewDocument.mimeType,
          },
        });
      }

      await appendJobLog({
        jobId: existingJob.id,
        action: jobapprovallog_action.UPDATED,
        performedBy: params.actorId,
        tx,
      });

      const images = await tx.jobimage.findMany({
        where: { jobId: existingJob.id },
        orderBy: { slot: 'asc' },
      });

      return { job, images, document: documentRecord };
    });

    const queue = getJobApprovalQueueContext();
    await queue.add('job.updated', {
      jobId: result.job.id,
      employerId: params.employerId,
      employerEmail: result.job.employerEmail ?? existingJob.employerEmail ?? null,
      title: result.job.title,
      slug: result.job.slug,
      source: 'update',
      submittedAt: new Date().toISOString(),
    });

    await Promise.allSettled(
      imagesToRemove.map((image) => imageStorage.delete(existingJob.id, image.filePath)),
    );

    // Delete old document if replaced or removed
    if ((params.removeDocument || savedNewDocument) && existingJob.document) {
      await documentStorage.delete(existingJob.id, existingJob.document.filePath);
    }

    const redis = getRedisConnection();
    await redis.set(SEARCH_FRESHNESS_KEY, result.job.updatedAt.toISOString()).catch(() => null);

    return result;
  } catch (error) {
    await Promise.allSettled(
      savedNewImages.map((file) => imageStorage.delete(existingJob.id, file.relativePath)),
    );
    if (savedNewDocument) {
      await documentStorage.delete(existingJob.id, savedNewDocument.relativePath);
    }
    throw error;
  }
}

export async function deleteJob(params: DeleteJobParams): Promise<void> {
  const job = await prisma.job.findFirst({
    where: {
      id: params.jobId,
      employerId: params.employerId,
      status: { not: 'DELETED' },
    },
    include: {
      jobimage: true,
      document: true,
      applications: {
        include: {
          candidate: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Store applications before deleting for email notification
  const applicationsToNotify = job.applications.filter(app => app.candidate?.email);

  await prisma.$transaction(async (tx) => {
    // Delete all applications for this job
    await tx.application.deleteMany({
      where: { jobId: job.id },
    });

    await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedBy: params.actorId,
      },
    });

    await appendJobLog({
      jobId: job.id,
      action: jobapprovallog_action.DELETED,
      performedBy: params.actorId,
      tx,
    });
  });

  // Invalidate public jobs cache
  await invalidatePublicJobsCache();

  // Send email notifications to candidates asynchronously
  if (applicationsToNotify.length > 0) {
    sendJobDeletedNotifications(job.title, applicationsToNotify).catch((error) => {
      logger.warn({
        event: 'job_deleted_notification_failed',
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // NOTE: Do NOT delete physical files on soft delete (status=DELETED)
  // Files should only be deleted on hard delete or after a retention period
  // This allows job restoration without losing images/documents
  logger.info({
    event: 'job_soft_deleted',
    jobId: job.id,
    note: 'Physical files retained for potential restoration',
  });
}

export async function restoreJob(params: RestoreJobParams): Promise<job> {
  const job = await prisma.job.findFirst({
    where: {
      id: params.jobId,
      status: 'DELETED',
    },
    select: {
      id: true,
      employerId: true,
      deletedBy: true,
      title: true,
      slug: true,
      employerEmail: true,
      updatedAt: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Deleted job not found');
  }

  // Check permission: only the person who deleted can restore
  const isEmployer = job.employerId === params.actorId;
  const isDeleter = job.deletedBy === params.actorId;

  if (!isDeleter) {
    if (isEmployer && job.deletedBy !== job.employerId) {
      throw new ValidationError('Only admin who deleted this job can restore it');
    } else if (!isEmployer) {
      throw new ValidationError('Only the person who deleted this job can restore it');
    }
  }

  const restoredJob = await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        deletedAt: null,
        deletedBy: null,
      },
    });

    await appendJobLog({
      jobId: job.id,
      action: jobapprovallog_action.SUBMITTED,
      performedBy: params.actorId,
      note: 'Job restored from deleted status',
      tx,
    });

    return updated;
  });

  // Invalidate public jobs cache
  await invalidatePublicJobsCache();

  const queue = getJobApprovalQueueContext();
  await queue.add('job.restored', {
    jobId: restoredJob.id,
    employerId: params.employerId,
    employerEmail: restoredJob.employerEmail ?? null,
    title: restoredJob.title,
    slug: restoredJob.slug,
    source: 'update',
    submittedAt: new Date().toISOString(),
  });

  const redis = getRedisConnection();
  await redis.set(SEARCH_FRESHNESS_KEY, restoredJob.updatedAt.toISOString()).catch(() => null);

  return restoredJob;
}

export async function listJobsForAdmin(params: AdminListJobsParams): Promise<{
  data: Array<
    job & {
      jobimage: jobimage[];
      jobapprovallog: jobapprovallog[];
      document: JobDocument | null;
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 50);
  const skip = (page - 1) * limit;

  const where: Prisma.jobWhereInput = {};

  const statusFilter = params.status ?? 'PENDING';
  if (statusFilter !== 'ALL') {
    where.status = statusFilter;
  }

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        jobimage: {
          orderBy: { slot: 'asc' },
        },
        jobapprovallog: {
          orderBy: { createdAt: 'desc' },
        },
        document: true,
      },
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data: jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function approveJob(params: ApproveJobParams): Promise<job & { employerEmail?: string | null }> {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    select: {
      id: true,
      employerId: true,
      employerEmail: true,
      title: true,
      slug: true,
      status: true,
      deletedAt: true,
      jobimage: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  if (job.status === 'DELETED') {
    throw new ValidationError('Deleted jobs cannot be approved');
  }

  const result = await prisma.$transaction(async (tx) => {
    const result = await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'APPROVED',
        publishedAt: new Date(),
      },
      select: {
        id: true,
        employerId: true,
        employerEmail: true,
        title: true,
        slug: true,
        status: true,
        jobType: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        jobimage: true,
      },
    });

    await appendJobLog({
      jobId: job.id,
      action: jobapprovallog_action.ADMIN_APPROVED,
      performedBy: params.actorId,
      tx,
    });

    return result;
  });

  // Invalidate public jobs cache
  await invalidatePublicJobsCache();

  return result as any;
}

export async function rejectJob(params: RejectJobParams): Promise<job & { employerEmail?: string | null }> {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
    select: {
      id: true,
      employerId: true,
      employerEmail: true,
      title: true,
      slug: true,
      status: true,
      deletedAt: true,
      jobimage: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  if (job.status === 'DELETED') {
    throw new ValidationError('Deleted jobs cannot be rejected');
  }

  if (!params.note || params.note.trim().length === 0) {
    throw new ValidationError('Rejection note is required');
  }

  const result = await prisma.$transaction(async (tx) => {
    const result = await tx.job.update({
      where: { id: job.id },
      data: {
        status: 'REJECTED',
        publishedAt: null,
      },
      select: {
        id: true,
        employerId: true,
        employerEmail: true,
        title: true,
        slug: true,
        status: true,
        jobType: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        jobimage: true,
      },
    });

    await appendJobLog({
      jobId: job.id,
      action: jobapprovallog_action.REJECTED,
      performedBy: params.actorId,
      note: params.note,
      tx,
    });

    publishJobRejectedEvent({
      jobId: result.id,
      employerId: result.employerId,
      title: result.title,
      slug: result.slug,
      rejectedBy: params.actorId,
      rejectedAt: new Date().toISOString(),
      reason: params.note,
    });

    return result;
  });

  // Invalidate public jobs cache
  await invalidatePublicJobsCache();

  return result as any;
}

export async function listApprovedJobsPublic(params: PublicListJobsParams): Promise<PublicListJobsResult> {
  const { cacheWrapper, generatePaginationKey, deleteCache } = await import('../utils/cache');

  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 50);
  const skip = (page - 1) * limit;

  // Generate cache key
  const cacheKey = generatePaginationKey('public:jobs', page, limit);

  // Try to get from cache or execute query
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
            jobimage: {
              orderBy: { slot: 'asc' },
            },
          },
        }),
        prisma.job.count({ where }),
      ]);

      // Fetch employer data from auth-service
      const employerIds = [...new Set(jobs.map(job => job.employerId))];
      const employerMap = await fetchEmployerProfiles(employerIds);

      // Attach employer data to jobs
      const jobsWithEmployer = jobs.map(job => ({
        ...job,
        employer: employerMap.get(job.employerId) || null,
      }));

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data: jobsWithEmployer,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    },
    {
      ttl: 300, // 5 minutes
      prefix: 'jobs',
    }
  );
}

/**
 * Invalidate public jobs cache
 * Call this when jobs are approved/rejected/deleted
 */
export async function invalidatePublicJobsCache(): Promise<void> {
  const { deleteCachePattern } = await import('../utils/cache');
  await deleteCachePattern('public:jobs:*', 'jobs');
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
        jobimage: {
          orderBy: { slot: 'asc' },
        },
      },
    }),
    prisma.job.count({ where }),
  ]);

  // Fetch employer data from auth-service
  const employerIds = [...new Set(jobs.map(job => job.employerId))];
  const employerMap = await fetchEmployerProfiles(employerIds);

  // Attach employer data to jobs
  const jobsWithEmployer = jobs.map(job => ({
    ...job,
    employer: employerMap.get(job.employerId) || null,
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const response: SearchPublicJobsResult = {
    data: jobsWithEmployer,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
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
