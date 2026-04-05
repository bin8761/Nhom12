import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { type EmailVerificationJobPayload } from './emailVerificationQueue';
export declare function initEmailVerificationWorker(redis: Redis): Worker<EmailVerificationJobPayload>;
export declare function shutdownEmailVerificationWorker(): Promise<void>;
//# sourceMappingURL=emailVerificationWorker.d.ts.map