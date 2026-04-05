import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
export declare const APPROVAL_NOTIFICATION_QUEUE_NAME = "approval.notification";
export interface ApprovalNotificationJobPayload {
    userId: string;
    email: string;
    status: 'approved' | 'rejected' | 'pending';
    approvedBy?: string;
    reason?: string;
    note?: string;
    rejectedBy?: string;
}
export declare function initApprovalNotificationQueue(redisConnection: Redis): Promise<Queue<ApprovalNotificationJobPayload>>;
export declare function getApprovalNotificationQueue(): Queue<ApprovalNotificationJobPayload>;
export declare function shutdownApprovalNotificationQueue(): Promise<void>;
//# sourceMappingURL=approvalNotificationQueue.d.ts.map