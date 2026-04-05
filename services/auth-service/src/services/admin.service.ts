import { getPrismaClient } from '../infra/prisma/prismaClient';
import { ApprovalStatus, UserRole, UserStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getApprovalNotificationQueue } from '../jobs/approvalNotificationQueue';
import { publishEmployerApprovalEvent } from '../events/authEvents';
import logger from '../utils/logger';

const prisma = getPrismaClient();

export async function getPendingEmployers() {
  const employers = await prisma.user.findMany({
    where: {
      role: UserRole.EMPLOYER,
      approvalStatus: ApprovalStatus.PENDING,
      emailVerified: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      status: true,
      approvalStatus: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      employerProfile: {
        select: {
          companyName: true,
          companyWebsite: true,
          headquartersLocation: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return employers;
}

export async function getAllUsers(filters: {
  role?: 'CANDIDATE' | 'EMPLOYER' | 'ADMIN';
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const where: any = {};

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.approvalStatus) {
    where.approvalStatus = filters.approvalStatus;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        approvalStatus: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function approveEmployer(params: {
  userId: string;
  adminId: string;
  note?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      employerProfile: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.role !== UserRole.EMPLOYER) {
    throw new ValidationError('User is not an employer');
  }

  if (user.approvalStatus === ApprovalStatus.APPROVED) {
    throw new ValidationError('Employer already approved');
  }

  if (!user.emailVerified) {
    throw new ValidationError('Email must be verified before approval');
  }

  // Update user status
  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: {
      status: UserStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedBy: params.adminId,
      rejectionReason: null,
    },
    include: {
      employerProfile: true,
    },
  });

  // Send notification email
  try {
    const notificationQueue = getApprovalNotificationQueue();
    await notificationQueue.add('send_approved', {
      userId: user.id,
      email: user.email,
      status: 'approved',
      approvedBy: params.adminId,
      note: params.note,
    });
  } catch (error) {
    logger.error({
      event: 'approval_notification_queue_failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Publish event
  try {
    await publishEmployerApprovalEvent({
      userId: user.id,
      email: user.email,
      role: 'employer',
      approvalStatus: 'approved',
      approvedBy: params.adminId,
      approvedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      event: 'approval_event_publish_failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    fullName: updatedUser.fullName,
    status: updatedUser.status,
    approvalStatus: updatedUser.approvalStatus,
    approvedAt: updatedUser.approvedAt,
    approvedBy: updatedUser.approvedBy,
  };
}

export async function rejectEmployer(params: {
  userId: string;
  adminId: string;
  reason: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.role !== UserRole.EMPLOYER) {
    throw new ValidationError('User is not an employer');
  }

  if (user.approvalStatus === ApprovalStatus.REJECTED) {
    throw new ValidationError('Employer already rejected');
  }

  // Update user status
  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      rejectionReason: params.reason,
      approvedBy: params.adminId,
      approvedAt: new Date(),
    },
  });

  // Send notification email
  try {
    const notificationQueue = getApprovalNotificationQueue();
    await notificationQueue.add('send_rejected', {
      userId: user.id,
      email: user.email,
      status: 'rejected',
      reason: params.reason,
      rejectedBy: params.adminId,
    });
  } catch (error) {
    logger.error({
      event: 'rejection_notification_queue_failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Publish event
  try {
    await publishEmployerApprovalEvent({
      userId: user.id,
      email: user.email,
      role: 'employer',
      approvalStatus: 'rejected',
      approvedBy: params.adminId,
      approvedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({
      event: 'rejection_event_publish_failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    fullName: updatedUser.fullName,
    status: updatedUser.status,
    approvalStatus: updatedUser.approvalStatus,
    rejectionReason: updatedUser.rejectionReason,
  };
}

export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      candidateProfile: true,
      employerProfile: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    role: user.role,
    status: user.status,
    approvalStatus: user.approvalStatus,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    rejectionReason: user.rejectionReason,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    candidateProfile: user.candidateProfile,
    employerProfile: user.employerProfile,
  };
}
