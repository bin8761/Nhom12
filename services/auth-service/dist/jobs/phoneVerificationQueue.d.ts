import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
export declare const PHONE_VERIFICATION_QUEUE_NAME = "phone.verification";
export type PhoneVerificationJobOrigin = 'register' | 'resend' | 'other';
export interface PhoneVerificationJobPayload {
    userId: string;
    phoneNumber: string;
    code: string;
    origin?: PhoneVerificationJobOrigin;
}
export declare function initPhoneVerificationQueue(redisConnection: Redis): Promise<Queue<PhoneVerificationJobPayload>>;
export declare function getPhoneVerificationQueue(): Queue<PhoneVerificationJobPayload>;
export declare function shutdownPhoneVerificationQueue(): Promise<void>;
//# sourceMappingURL=phoneVerificationQueue.d.ts.map