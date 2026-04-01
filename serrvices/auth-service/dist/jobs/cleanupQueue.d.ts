import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
export declare const CLEANUP_QUEUE_NAME = "maintenance.cleanup";
export interface CleanupJobPayload {
    task: 'purge-expired';
}
export declare function initCleanupQueue(redisConnection: Redis): Promise<Queue<CleanupJobPayload>>;
export declare function getCleanupQueue(): Queue<CleanupJobPayload>;
export declare function scheduleCleanupJobs(): Promise<void>;
export declare function shutdownCleanupQueue(): Promise<void>;
//# sourceMappingURL=cleanupQueue.d.ts.map