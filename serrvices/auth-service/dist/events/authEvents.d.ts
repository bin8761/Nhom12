export interface AuthUserRegisteredEvent {
    id: string;
    email: string;
    role: string;
    emittedAt: string;
}
export interface EmployerApprovalEvent {
    userId: string;
    email: string;
    role: string;
    approvalStatus: 'approved' | 'rejected' | 'pending';
    approvedBy: string | null;
    approvedAt: string;
    rejectionReason?: string;
}
export interface UserProfileUpdatedEvent {
    userId: string;
    role: 'CANDIDATE' | 'EMPLOYER';
    changedFields: string[];
    updatedAt: string | null;
}
export declare function publishAuthUserRegisteredEvent(event: AuthUserRegisteredEvent): Promise<void>;
export declare function publishEmployerApprovalEvent(event: EmployerApprovalEvent): Promise<void>;
export declare function publishUserProfileUpdatedEvent(event: UserProfileUpdatedEvent): Promise<void>;
//# sourceMappingURL=authEvents.d.ts.map