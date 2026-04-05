import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { type ApprovalNotificationJobPayload } from './approvalNotificationQueue';
export declare function initApprovalNotificationWorker(redis: Redis): Worker<ApprovalNotificationJobPayload>;
export declare function shutdownApprovalNotificationWorker(): Promise<void>;
//# sourceMappingURL=approvalNotificationWorker.d.ts.map