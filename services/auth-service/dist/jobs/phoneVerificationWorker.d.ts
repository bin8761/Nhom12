import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { type PhoneVerificationJobPayload } from './phoneVerificationQueue';
export declare function initPhoneVerificationWorker(redis: Redis): Worker<PhoneVerificationJobPayload>;
export declare function shutdownPhoneVerificationWorker(): Promise<void>;
//# sourceMappingURL=phoneVerificationWorker.d.ts.map