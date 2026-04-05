"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingEmployers = getPendingEmployers;
exports.getAllUsers = getAllUsers;
exports.approveEmployer = approveEmployer;
exports.rejectEmployer = rejectEmployer;
exports.getUserDetails = getUserDetails;
const prismaClient_1 = require("../infra/prisma/prismaClient");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const approvalNotificationQueue_1 = require("../jobs/approvalNotificationQueue");
const authEvents_1 = require("../events/authEvents");
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = (0, prismaClient_1.getPrismaClient)();
async function getPendingEmployers() {
    const employers = await prisma.user.findMany({
        where: {
            role: client_1.UserRole.EMPLOYER,
            approvalStatus: client_1.ApprovalStatus.PENDING,
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
async function getAllUsers(filters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const where = {};
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
async function approveEmployer(params) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
        include: {
            employerProfile: true,
        },
    });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    if (user.role !== client_1.UserRole.EMPLOYER) {
        throw new errors_1.ValidationError('User is not an employer');
    }
    if (user.approvalStatus === client_1.ApprovalStatus.APPROVED) {
        throw new errors_1.ValidationError('Employer already approved');
    }
    if (!user.emailVerified) {
        throw new errors_1.ValidationError('Email must be verified before approval');
    }
    // Update user status
    const updatedUser = await prisma.user.update({
        where: { id: params.userId },
        data: {
            status: client_1.UserStatus.ACTIVE,
            approvalStatus: client_1.ApprovalStatus.APPROVED,
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
        const notificationQueue = (0, approvalNotificationQueue_1.getApprovalNotificationQueue)();
        await notificationQueue.add('send_approved', {
            userId: user.id,
            email: user.email,
            status: 'approved',
            approvedBy: params.adminId,
            note: params.note,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'approval_notification_queue_failed',
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    // Publish event
    try {
        await (0, authEvents_1.publishEmployerApprovalEvent)({
            userId: user.id,
            email: user.email,
            role: 'employer',
            approvalStatus: 'approved',
            approvedBy: params.adminId,
            approvedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.default.error({
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
async function rejectEmployer(params) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
    });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    if (user.role !== client_1.UserRole.EMPLOYER) {
        throw new errors_1.ValidationError('User is not an employer');
    }
    if (user.approvalStatus === client_1.ApprovalStatus.REJECTED) {
        throw new errors_1.ValidationError('Employer already rejected');
    }
    // Update user status
    const updatedUser = await prisma.user.update({
        where: { id: params.userId },
        data: {
            approvalStatus: client_1.ApprovalStatus.REJECTED,
            rejectionReason: params.reason,
            approvedBy: params.adminId,
            approvedAt: new Date(),
        },
    });
    // Send notification email
    try {
        const notificationQueue = (0, approvalNotificationQueue_1.getApprovalNotificationQueue)();
        await notificationQueue.add('send_rejected', {
            userId: user.id,
            email: user.email,
            status: 'rejected',
            reason: params.reason,
            rejectedBy: params.adminId,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'rejection_notification_queue_failed',
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    // Publish event
    try {
        await (0, authEvents_1.publishEmployerApprovalEvent)({
            userId: user.id,
            email: user.email,
            role: 'employer',
            approvalStatus: 'rejected',
            approvedBy: params.adminId,
            approvedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.default.error({
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
async function getUserDetails(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            candidateProfile: true,
            employerProfile: true,
        },
    });
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
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
//# sourceMappingURL=admin.service.js.map