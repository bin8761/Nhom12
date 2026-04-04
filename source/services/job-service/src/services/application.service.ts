import { Prisma, job_status, ApplicationStatus } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';
import { sendNewApplicationNotificationEmail } from '../infra/email/smtpMailer';
import type { ParsedFields } from '../contracts/cv.types';
import { parseJsonObject } from '../utils/json';

const prisma = getPrismaClient();

/**
 * Helper function to send email notification to employer
 */
async function sendEmployerNotificationEmail(
  employerId: string,
  employerEmail: string | null,
  jobTitle: string,
  applicationId: string,
  candidate: { email: string; fullName: string | null },
): Promise<void> {
  try {
    // If employer email is not in job record, fetch from auth service
    let finalEmployerEmail = employerEmail;
    
    if (!finalEmployerEmail) {
      const authApiUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
      const response = await fetch(`${authApiUrl}/internal/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET || 'dev-internal-secret',
        },
        body: JSON.stringify({ userIds: [employerId] }),
      });

      if (!response.ok) {
        logger.warn({
          event: 'fetch_employer_email_failed',
          employerId,
          status: response.status,
        });
        return;
      }

      const data = await response.json();
      const employer = data.data?.[0];

      if (!employer?.email) {
        logger.warn({
          event: 'employer_email_not_found',
          employerId,
        });
        return;
      }
      
      finalEmployerEmail = employer.email;
    }

    // Send email notification with candidate info
    await sendNewApplicationNotificationEmail({
      to: finalEmployerEmail,
      jobTitle,
      candidateName: candidate.fullName || undefined,
      candidateEmail: candidate.email,
      candidatePhone: (candidate as any).phoneNumber || undefined,
      applicationId,
    });

    logger.info({
      event: 'employer_notification_email_sent',
      employerId,
      employerEmail: finalEmployerEmail,
      applicationId,
      jobTitle,
    });
  } catch (error) {
    logger.error({
      event: 'send_employer_notification_error',
      employerId,
      applicationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export interface CreateApplicationParams {
  jobId: string;
  candidateId: string;
}

export interface CreateApplicationResult {
  applicationId: string;
  status: ApplicationStatus;
  createdAt: Date;
}

export interface ListCandidateApplicationsParams {
  candidateId: string;
  page: number;
  limit: number;
}

export interface UpdateApplicationStatusParams {
  applicationId: string;
  employerId: string;
  newStatus: ApplicationStatus;
  note?: string;
}

/**
 * Create a new job application with full validation
 */
export async function createJobApplication(
  params: CreateApplicationParams,
): Promise<CreateApplicationResult> {
  const { jobId, candidateId } = params;

  // 1. Validate job exists and is approved
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      title: true,
      employerId: true,
      employerEmail: true,
      deletedAt: true,
    },
  });

  if (!job) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'job_not_found',
      jobId,
      candidateId,
    });
    throw new NotFoundError('Job not found');
  }

  if (job.deletedAt) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'job_deleted',
      jobId,
      candidateId,
    });
    throw new ValidationError('This job has been deleted');
  }

  if (job.status !== job_status.APPROVED) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'job_not_approved',
      jobId,
      candidateId,
      jobStatus: job.status,
    });
    throw new ValidationError('This job is not accepting applications');
  }

  // 2. Validate candidate exists
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, email: true, fullName: true, phoneNumber: true },
  });

  if (!candidate) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'candidate_not_found',
      jobId,
      candidateId,
    });
    throw new NotFoundError('Candidate not found');
  }

  // 3. Check if candidate already applied to this job (exclude withdrawn applications)
  const existingApplication = await prisma.application.findFirst({
    where: {
      jobId,
      candidateId,
      status: {
        not: ApplicationStatus.WITHDRAWN,
      },
    },
    select: { id: true, status: true, createdAt: true },
  });

  if (existingApplication) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'already_applied',
      jobId,
      candidateId,
      existingApplicationId: existingApplication.id,
    });
    throw new ConflictError('You have already applied to this job');
  }

  // 4. Validate candidate cannot apply to their own job
  if (job.employerId === candidateId) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'self_application',
      jobId,
      candidateId,
    });
    throw new ValidationError('You cannot apply to your own job posting');
  }



  // 6. Get candidate's CV data (uploaded file only)
  const latestCv = await prisma.candidateCv.findFirst({
    where: { candidateId },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      status: true,
      parsedFields: true,
      filePath: true,
    },
  });

  // Validate: Must have uploaded CV
  if (!latestCv) {
    logger.warn({
      event: 'application_create_failed',
      reason: 'no_cv_uploaded',
      jobId,
      candidateId,
    });
    throw new ValidationError('You must upload a CV before applying');
  }

  // Check if CV is parsed
  if (latestCv.status !== 'PARSED') {
    logger.warn({
      event: 'application_create_failed',
      reason: 'cv_not_parsed',
      jobId,
      candidateId,
      cvStatus: latestCv.status,
    });
    throw new ValidationError('Your CV is still being processed. Please wait and try again.');
  }

  // 7. Create application with CV snapshot from uploaded file
  const parsedFields = parseJsonObject<ParsedFields>(latestCv.parsedFields);
  
  // Ensure cvSnapshot is a proper object, not a string or malformed object
  let cvSnapshot: Record<string, any> | null = null;
  if (parsedFields && typeof parsedFields === 'object') {
    cvSnapshot = { ...parsedFields, source: 'file' };
  }

  try {
    const application = await prisma.application.create({
      data: {
        jobId,
        candidateId,
        status: ApplicationStatus.SUBMITTED,
        cvFileId: latestCv?.id ?? null,
        cvSnapshot: cvSnapshot ? JSON.stringify(cvSnapshot) : null,
        cvStatus: 'PENDING',
      },
    });

    logger.info({
      event: 'application_created',
      applicationId: application.id,
      jobId,
      candidateId,
      jobTitle: job.title,
    });

    // Send email notification to employer asynchronously
    sendEmployerNotificationEmail(
      job.employerId,
      job.employerEmail,
      job.title,
      application.id,
      candidate
    ).catch((emailError) => {
      logger.warn({
        event: 'employer_notification_email_failed',
        applicationId: application.id,
        jobId,
        employerId: job.employerId,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    });

    return {
      applicationId: application.id,
      status: application.status,
      createdAt: application.createdAt,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('You have already applied to this job');
    }
    throw error;
  }
}

/**
 * List all applications for a candidate
 */
export async function listCandidateApplications(
  params: ListCandidateApplicationsParams,
) {
  const { candidateId, page, limit } = params;
  const skip = (page - 1) * limit;

  const [applications, total] = await prisma.$transaction([
    prisma.application.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        jobId: true,
        candidateId: true,
        status: true,
        cvFileId: true,
        cvStatus: true,
        cvDecisionNote: true,
        cvReviewedAt: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            jobType: true,
            salary: true,
            currency: true,
            status: true,
          },
        },
      },
    }),
    prisma.application.count({ where: { candidateId } }),
  ]);

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update application status (for employer)
 */
export async function updateApplicationStatus(
  params: UpdateApplicationStatusParams,
) {
  const { applicationId, employerId, newStatus, note } = params;

  // 1. Get application with job info
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        select: {
          id: true,
          employerId: true,
          title: true,
        },
      },
      candidate: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // 2. Verify employer owns this job
  if (application.job.employerId !== employerId) {
    throw new ValidationError('You can only update applications for your own jobs');
  }

  // 3. Validate status transition
  const validTransitions: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
    SUBMITTED: ['REVIEWED', 'REJECTED'],
    REVIEWED: ['INTERVIEW', 'REJECTED'],
    INTERVIEW: ['OFFER', 'REJECTED'],
    OFFER: ['REJECTED'], // Can still reject after offer
    REJECTED: [], // Cannot change from rejected
  };

  const allowedStatuses = validTransitions[application.status];
  if (!allowedStatuses.includes(newStatus)) {
    throw new ValidationError(
      `Cannot change status from ${application.status} to ${newStatus}`,
    );
  }

  // 4. Update application
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  logger.info({
    event: 'application_status_updated',
    applicationId,
    jobId: application.job.id,
    candidateId: application.candidate.id,
    oldStatus: application.status,
    newStatus,
    employerId,
  });

  return updated;
}

/**
 * Get application details
 */
export async function getApplicationDetails(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          jobType: true,
          salary: true,
          currency: true,
          employerId: true,
        },
      },
      candidate: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  return application;
}

/**
 * Check if candidate can apply to job
 */
export async function canCandidateApply(
  jobId: string,
  candidateId: string,
): Promise<{ canApply: boolean; reason?: string }> {
  // Check job exists and is approved
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, employerId: true, deletedAt: true },
  });

  if (!job) {
    return { canApply: false, reason: 'Job not found' };
  }

  if (job.deletedAt) {
    return { canApply: false, reason: 'Job has been deleted' };
  }

  if (job.status !== job_status.APPROVED) {
    return { canApply: false, reason: 'Job is not accepting applications' };
  }

  if (job.employerId === candidateId) {
    return { canApply: false, reason: 'Cannot apply to your own job' };
  }

  // Check if already applied (exclude withdrawn applications)
  const existingApplication = await prisma.application.findFirst({
    where: { 
      jobId, 
      candidateId,
      status: {
        not: 'WITHDRAWN',
      },
    },
  });

  if (existingApplication) {
    return { canApply: false, reason: 'Already applied to this job' };
  }

  // Check if candidate has uploaded CV
  const hasCvFile = await prisma.candidateCv.findFirst({
    where: { candidateId, status: 'PARSED' },
  });

  // Candidate must have uploaded CV
  if (!hasCvFile) {
    return { canApply: false, reason: 'Must upload CV before applying' };
  }

  return { canApply: true };
}

/**
 * Withdraw/cancel application (for candidate)
 */
export async function withdrawApplication(
  applicationId: string,
  candidateId: string,
): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      candidateId: true,
      status: true,
      jobId: true,
    },
  });

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // Verify ownership
  if (application.candidateId !== candidateId) {
    throw new ValidationError('You can only withdraw your own applications');
  }

  // Only allow withdrawal of SUBMITTED or REVIEWED applications
  if (!['SUBMITTED', 'REVIEWED'].includes(application.status)) {
    throw new ValidationError(
      `Cannot withdraw application with status ${application.status}`,
    );
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.WITHDRAWN,
      updatedAt: new Date(),
    },
  });

  logger.info({
    event: 'application_withdrawn',
    applicationId,
    candidateId,
    jobId: application.jobId,
  });
}
