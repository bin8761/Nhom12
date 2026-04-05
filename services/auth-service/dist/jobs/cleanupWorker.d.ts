import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { type CleanupJobPayload } from './cleanupQueue';
export declare function initCleanupWorker(redis: Redis): Worker<CleanupJobPayload>;
export declare function shutdownCleanupWorker(): Promise<void>;
//# sourceMappingURL=cleanupWorker.d.ts.map