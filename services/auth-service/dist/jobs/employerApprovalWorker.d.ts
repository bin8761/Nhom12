import type { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { type EmployerApprovalJobPayload } from './employerApprovalQueue';
export declare function initEmployerApprovalWorker(redis: Redis): Worker<EmployerApprovalJobPayload>;
export declare function shutdownEmployerApprovalWorker(): Promise<void>;
//# sourceMappingURL=employerApprovalWorker.d.ts.map