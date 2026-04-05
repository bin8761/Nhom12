import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
export declare const EMPLOYER_APPROVAL_QUEUE_NAME = "employer.approval";
export interface EmployerApprovalJobPayload {
    userId: string;
    email: string;
    role: string;
    registrationData?: {
        ipAddress?: string | null;
        userAgent?: string | null;
        createdAt: Date;
    };
}
export declare function initEmployerApprovalQueue(redisConnection: Redis): Promise<Queue<EmployerApprovalJobPayload>>;
export declare function getEmployerApprovalQueue(): Queue<EmployerApprovalJobPayload>;
export declare function shutdownEmployerApprovalQueue(): Promise<void>;
//# sourceMappingURL=employerApprovalQueue.d.ts.map