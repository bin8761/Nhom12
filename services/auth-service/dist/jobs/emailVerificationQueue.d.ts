import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
export declare const EMAIL_VERIFICATION_QUEUE_NAME = "email.verification";
export interface EmailVerificationJobPayload {
    userId: string;
    email: string;
    verificationCode: string;
    locale?: string;
}
export declare function initEmailVerificationQueue(redisConnection: Redis): Promise<Queue<EmailVerificationJobPayload>>;
export declare function getEmailVerificationQueue(): Queue<EmailVerificationJobPayload>;
export declare function shutdownEmailVerificationQueue(): Promise<void>;
//# sourceMappingURL=emailVerificationQueue.d.ts.map