import { job_status } from '@prisma/client';

const prismaJobFindUniqueMock = jest.fn();
const prismaJobUpdateMock = jest.fn();
const prismaTransactionMock = jest.fn();

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: jest.fn(() => ({
    job: {
      findUnique: prismaJobFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  })),
}));

const appendJobLogMock = jest.fn();
jest.mock('../../services/audit-log.service', () => ({
  appendJobLog: appendJobLogMock,
}));

const publishJobApprovedEventMock = jest.fn();
jest.mock('../../events/jobEvents', () => ({
  publishJobApprovedEvent: publishJobApprovedEventMock,
  publishJobRejectedEvent: jest.fn(),
}));

const sendJobApprovedEmailMock = jest.fn();
jest.mock('../../infra/email/smtpMailer', () => ({
  sendJobApprovedEmail: sendJobApprovedEmailMock,
}));

jest.mock('../../config/appConfig', () => ({
  loadAppConfig: jest.fn(() => ({
    queues: {
      jobApproval: {
        name: 'jobApprovalQueue',
        prefix: 'bull',
      },
    },
  })),
}));

type WorkerHandlerMap = Record<string, ((...args: any[]) => any) | undefined>;

const queueAddMock = jest.fn();
const queueCloseMock = jest.fn();

const workerHandlerStore: { handlers: WorkerHandlerMap; processor?: (job: any) => Promise<void> } = {
  handlers: {},
};

jest.mock('bullmq', () => {
  const WorkerMock = jest.fn((_name, processor) => {
    workerHandlerStore.processor = processor;
    workerHandlerStore.handlers = {};
    return {
      on: jest.fn((event, handler) => {
        workerHandlerStore.handlers[event] = handler;
        return this;
      }),
      close: jest.fn(async () => undefined),
    };
  });

  const QueueMock = jest.fn(() => ({
    add: queueAddMock,
    close: queueCloseMock,
  }));

  return {
    Worker: WorkerMock,
    Queue: QueueMock,
  };
});

function createMockRedis() {
  return {
    duplicate: jest.fn(function duplicate() {
      return this;
    }),
  } as unknown as import('ioredis').Redis;
}

describe('jobApprovalWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    workerHandlerStore.handlers = {};
    workerHandlerStore.processor = undefined;
  });

  async function initWorker() {
    const { initJobApprovalWorker } = await import('../jobApprovalWorker');
    const redis = createMockRedis();
    initJobApprovalWorker(redis);
    const processor = workerHandlerStore.processor;
    if (!processor) {
      throw new Error('Worker processor not registered');
    }
    return { processor };
  }

  afterEach(async () => {
    const module = await import('../jobApprovalWorker');
    await module.shutdownJobApprovalWorker();
    jest.resetModules();
  });

  const baseJobData = {
    jobId: 'job-123',
    employerId: 'emp-1',
    employerEmail: 'employer@example.com',
    title: 'Awesome Job',
    slug: 'awesome-job',
    source: 'create' as const,
    submittedAt: new Date().toISOString(),
  };

  it('approves pending job and emits email/event side effects', async () => {
    const updatedJob = {
      id: baseJobData.jobId,
      employerId: baseJobData.employerId,
      employerEmail: baseJobData.employerEmail,
      title: baseJobData.title,
      slug: baseJobData.slug,
      status: job_status.APPROVED,
      publishedAt: new Date('2025-11-02T00:00:00Z'),
    };

    prismaJobFindUniqueMock.mockResolvedValue({
      id: baseJobData.jobId,
      status: job_status.PENDING,
      employerEmail: baseJobData.employerEmail,
      employerId: baseJobData.employerId,
      title: baseJobData.title,
      slug: baseJobData.slug,
    });

    prismaJobUpdateMock.mockResolvedValue(updatedJob);
    prismaTransactionMock.mockImplementation(async (cb) =>
      cb({
        job: {
          update: prismaJobUpdateMock,
        },
      }),
    );

    const { processor } = await initWorker();
    await processor({ data: baseJobData });

    expect(prismaJobFindUniqueMock).toHaveBeenCalledWith({ where: { id: baseJobData.jobId } });
    expect(prismaJobUpdateMock).toHaveBeenCalledWith({
      where: { id: baseJobData.jobId },
      data: expect.objectContaining({ status: job_status.APPROVED }),
    });
    expect(appendJobLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: baseJobData.jobId,
        action: 'AUTO_APPROVED',
      }),
    );
    expect(publishJobApprovedEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: baseJobData.jobId,
        employerId: baseJobData.employerId,
      }),
    );
    expect(sendJobApprovedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: baseJobData.employerEmail,
        jobId: baseJobData.jobId,
      }),
    );
  });

  it('is idempotent when job is not pending', async () => {
    prismaJobFindUniqueMock.mockResolvedValue({
      id: baseJobData.jobId,
      status: job_status.APPROVED,
    });

    const { processor } = await initWorker();
    await processor({ data: baseJobData });

    expect(prismaJobUpdateMock).not.toHaveBeenCalled();
    expect(appendJobLogMock).not.toHaveBeenCalled();
    expect(publishJobApprovedEventMock).not.toHaveBeenCalled();
    expect(sendJobApprovedEmailMock).not.toHaveBeenCalled();
  });

  it('pushes job to dead-letter queue when processor fails after retries', async () => {
    const { processor } = await initWorker();

    const failedHandler = workerHandlerStore.handlers.failed;
    expect(failedHandler).toBeDefined();

    const error = new Error('processing failed');
    await failedHandler?.({ data: baseJobData, attemptsMade: 3 }, error);

    expect(queueAddMock).toHaveBeenCalledWith(
      'dead-letter',
      baseJobData,
      expect.objectContaining({
        attempts: 1,
        removeOnComplete: true,
      }),
    );
  });
});
