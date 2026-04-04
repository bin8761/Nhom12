import type { CvProcessingJobPayload } from '../../jobs/cvProcessingQueue';
import { getCvProcessingQueue } from '../../jobs/cvProcessingQueue';

export async function enqueueCvProcessingJob(payload: CvProcessingJobPayload): Promise<void> {
  const queue = getCvProcessingQueue();
  await queue.add('process-cv', payload, {
    jobId: payload.cvId,
    removeOnComplete: true,
    removeOnFail: false,
  });
}
