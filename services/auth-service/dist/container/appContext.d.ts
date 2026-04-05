import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { AppConfig } from '../config/appConfig';
import { EmailVerificationJobPayload } from '../jobs/emailVerificationQueue';
import { CleanupJobPayload } from '../jobs/cleanupQueue';
import { EmployerApprovalJobPayload } from '../jobs/employerApprovalQueue';
import { ApprovalNotificationJobPayload } from '../jobs/approvalNotificationQueue';
import { PhoneVerificationJobPayload } from '../jobs/phoneVerificationQueue';
export interface QueuesContext {
    emailVerification: Queue<EmailVerificationJobPayload>;
    cleanup: Queue<CleanupJobPayload>;
    employerApproval: Queue<EmployerApprovalJobPayload>;
    approvalNotification: Queue<ApprovalNotificationJobPayload>;
    phoneVerification: Queue<PhoneVerificationJobPayload>;
}
export interface AppContext {
    config: AppConfig;
    redis: Redis;
    queues: QueuesContext;
}
export declare function bootstrapAppContext(): Promise<AppContext>;
export declare function getRedisConnection(): Redis;
export declare function getEmailVerificationQueueContext(): Queue<EmailVerificationJobPayload>;
export declare function getCleanupQueueContext(): Queue<CleanupJobPayload>;
export declare function getEmployerApprovalQueueContext(): Queue<EmployerApprovalJobPayload>;
export declare function getApprovalNotificationQueueContext(): Queue<ApprovalNotificationJobPayload>;
export declare function getPhoneVerificationQueueContext(): Queue<PhoneVerificationJobPayload>;
export declare function shutdownAppContext(): Promise<void>;
//# sourceMappingURL=appContext.d.ts.map