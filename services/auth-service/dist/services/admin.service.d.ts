export declare function getPendingEmployers(): Promise<{
    status: import(".prisma/client").$Enums.UserStatus;
    employerProfile: {
        companyName: string;
        companyWebsite: string;
        headquartersLocation: string;
        contactEmail: string;
        contactPhone: string;
    };
    id: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
    phoneNumber: string;
    emailVerified: boolean;
    approvalStatus: import(".prisma/client").$Enums.ApprovalStatus;
    fullName: string;
}[]>;
export declare function getAllUsers(filters: {
    role?: 'CANDIDATE' | 'EMPLOYER' | 'ADMIN';
    status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    page?: number;
    limit?: number;
}): Promise<{
    data: {
        status: import(".prisma/client").$Enums.UserStatus;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        email: string;
        createdAt: Date;
        updatedAt: Date;
        emailVerified: boolean;
        approvalStatus: import(".prisma/client").$Enums.ApprovalStatus;
        fullName: string;
    }[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>;
export declare function approveEmployer(params: {
    userId: string;
    adminId: string;
    note?: string;
}): Promise<{
    id: string;
    email: string;
    fullName: string;
    status: import(".prisma/client").$Enums.UserStatus;
    approvalStatus: import(".prisma/client").$Enums.ApprovalStatus;
    approvedAt: Date;
    approvedBy: string;
}>;
export declare function rejectEmployer(params: {
    userId: string;
    adminId: string;
    reason: string;
}): Promise<{
    id: string;
    email: string;
    fullName: string;
    status: import(".prisma/client").$Enums.UserStatus;
    approvalStatus: import(".prisma/client").$Enums.ApprovalStatus;
    rejectionReason: string;
}>;
export declare function getUserDetails(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    address: string;
    role: import(".prisma/client").$Enums.UserRole;
    status: import(".prisma/client").$Enums.UserStatus;
    approvalStatus: import(".prisma/client").$Enums.ApprovalStatus;
    emailVerified: boolean;
    phoneVerified: boolean;
    approvedAt: Date;
    approvedBy: string;
    rejectionReason: string;
    createdAt: Date;
    updatedAt: Date;
    candidateProfile: {
        id: string;
        userId: string;
        fullName: string;
        phoneNumber: string | null;
        location: string | null;
        createdAt: Date;
        updatedAt: Date;
        updatedBy: string;
        dateOfBirth: Date | null;
    };
    employerProfile: {
        id: string;
        userId: string;
        companyName: string;
        companyWebsite: string | null;
        headquartersLocation: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        createdAt: Date;
        updatedAt: Date;
        updatedBy: string;
    };
}>;
//# sourceMappingURL=admin.service.d.ts.map