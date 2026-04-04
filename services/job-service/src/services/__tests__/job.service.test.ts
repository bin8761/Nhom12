import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createJobWithImages } from '../job.service';

jest.mock('../../infra/prisma/prismaClient', () => {
  const jobCreateMock = jest.fn();
  const jobImageCreateMock = jest.fn();
  const transactionMock = jest.fn(async (cb: any) =>
    cb({
      job: { create: jobCreateMock },
      jobImage: { create: jobImageCreateMock },
    }),
  );

  return {
    __esModule: true,
    getPrismaClient: jest.fn(() => ({
      $transaction: (cb: any) => transactionMock(cb),
    })),
    __mocks: {
      jobCreateMock,
      jobImageCreateMock,
      transactionMock,
    },
  };
});

jest.mock('../../utils/slug.util', () => {
  let counter = 0;
  return {
    __esModule: true,
    generateSlugBase: jest.fn(() => 'job-slug'),
    appendSlugDiscriminator: jest.fn(() => `job-slug-${++counter}`),
    __mocks: {
      reset: () => {
        counter = 0;
      },
    },
  };
});

jest.mock('../image-storage.service', () => {
  const validateFile = jest.fn();
  const save = jest.fn().mockResolvedValue('path');
  const deleteFn = jest.fn().mockResolvedValue(undefined);
  return {
    ImageStorageService: jest.fn(() => ({
      validateFile,
      save,
      delete: deleteFn,
    })),
    __mocks: {
      validateFile,
      save,
      deleteFn,
    },
  };
});

jest.mock('../../container/appContext', () => {
  const queueAddMock = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    getJobApprovalQueueContext: jest.fn(() => ({ add: queueAddMock })),
    __mocks: {
      queueAddMock,
    },
  };
});

jest.mock('../audit-log.service', () => {
  const appendJobLogMock = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    appendJobLog: jest.fn((params) => appendJobLogMock(params)),
    __mocks: {
      appendJobLogMock,
    },
  };
});

jest.mock('../../events/jobEvents', () => {
  const publishJobCreatedEvent = jest.fn();
  return {
    __esModule: true,
    publishJobCreatedEvent,
    publishJobApprovedEvent: jest.fn(),
    publishJobRejectedEvent: jest.fn(),
    __mocks: {
      publishJobCreatedEvent,
    },
  };
});

const prismaModule = jest.requireMock('../../infra/prisma/prismaClient') as {
  __mocks: {
    jobCreateMock: jest.Mock;
    jobImageCreateMock: jest.Mock;
    transactionMock: jest.Mock;
  };
};
const slugModule = jest.requireMock('../../utils/slug.util') as {
  __mocks: { reset: () => void };
};
const imageStorageModule = jest.requireMock('../image-storage.service') as {
  __mocks: {
    validateFile: jest.Mock;
    save: jest.Mock;
    deleteFn: jest.Mock;
  };
};
const queueModule = jest.requireMock('../../container/appContext') as {
  __mocks: { queueAddMock: jest.Mock };
};
const auditLogModule = jest.requireMock('../audit-log.service') as {
  __mocks: { appendJobLogMock: jest.Mock };
};
const eventsModule = jest.requireMock('../../events/jobEvents') as {
  __mocks: { publishJobCreatedEvent: jest.Mock };
};

const jobCreateMock = prismaModule.__mocks.jobCreateMock;
const jobImageCreateMock = prismaModule.__mocks.jobImageCreateMock;
const transactionMock = prismaModule.__mocks.transactionMock;
const queueAddMock = queueModule.__mocks.queueAddMock;
const appendJobLogMock = auditLogModule.__mocks.appendJobLogMock;
const publishJobCreatedEventMock = eventsModule.__mocks.publishJobCreatedEvent;
const imageValidateMock = imageStorageModule.__mocks.validateFile;
const imageSaveMock = imageStorageModule.__mocks.save;
const imageDeleteMock = imageStorageModule.__mocks.deleteFn;

transactionMock.mockImplementation(async (cb: any) =>
  cb({
    job: { create: jobCreateMock },
    jobImage: { create: jobImageCreateMock },
  }),
);
queueAddMock.mockResolvedValue(undefined);
appendJobLogMock.mockResolvedValue(undefined);
imageSaveMock.mockResolvedValue('path');
imageDeleteMock.mockResolvedValue(undefined);

describe('createJobWithImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    slugModule.__mocks.reset();
    jobCreateMock.mockReset();
    jobImageCreateMock.mockReset();
    queueAddMock.mockReset();
    queueAddMock.mockResolvedValue(undefined);
    imageValidateMock.mockReset();
    imageSaveMock.mockReset();
    imageSaveMock.mockResolvedValue('path');
    imageDeleteMock.mockReset();
    imageDeleteMock.mockResolvedValue(undefined);
    appendJobLogMock.mockReset();
    appendJobLogMock.mockResolvedValue(undefined);
    publishJobCreatedEventMock.mockReset();
    transactionMock.mockImplementation(async (cb) =>
      cb({
        job: { create: jobCreateMock },
        jobImage: { create: jobImageCreateMock },
      }),
    );
  });

  it('retries slug generation when unique constraint conflicts occur', async () => {
    const uniqueError = new PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: '5.19.1',
      meta: { target: ['employerId', 'slug'] },
    });

    jobCreateMock.mockRejectedValueOnce(uniqueError);
    const createdJob = {
      id: 'job-id',
      employerId: 'emp',
      employerEmail: 'foo@bar.com',
      title: 'Some Job',
      slug: 'job-slug-1',
      createdAt: new Date('2025-11-11T00:00:00Z'),
    };
    jobCreateMock.mockResolvedValueOnce(createdJob);

    const result = await createJobWithImages({
      employerId: 'emp',
      actorId: 'emp',
      payload: {
        title: 'Some Job',
        description: 'x'.repeat(60),
        skills: ['ts'],
        salary: 100,
        currency: 'VND',
        location: 'HN',
        jobType: 'FULL_TIME',
      },
      images: [],
      employerEmail: 'foo@bar.com',
    });

    expect(jobCreateMock).toHaveBeenCalledTimes(2);
    expect(jobCreateMock.mock.calls[1][0].data.slug).toBe('job-slug-1');
    expect(result.job).toEqual(createdJob);
    expect(appendJobLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: createdJob.id,
        performedBy: 'emp',
      }),
    );
    expect(queueAddMock).toHaveBeenCalledWith(
      'job.submitted',
      expect.objectContaining({
        jobId: createdJob.id,
        slug: 'job-slug-1',
        source: 'create',
      }),
    );
    expect(publishJobCreatedEventMock).toHaveBeenCalledWith({
      jobId: createdJob.id,
      employerId: 'emp',
      title: createdJob.title,
      slug: createdJob.slug,
      createdAt: createdJob.createdAt.toISOString(),
    });
  });

  it('cleans up saved images when transaction fails', async () => {
    const createdJob = {
      id: 'job-cleanup',
      employerId: 'emp',
      employerEmail: null,
      title: 'Some Job',
      slug: 'job-slug',
      createdAt: new Date(),
    };
    jobCreateMock.mockResolvedValue(createdJob);
    imageValidateMock.mockReturnValue(undefined);
    imageSaveMock.mockResolvedValue('storage/job-cleanup/image.png');
    jobImageCreateMock.mockRejectedValueOnce(new Error('write failed'));

    await expect(
      createJobWithImages({
        employerId: 'emp',
        actorId: 'actor',
        payload: {
          title: 'Some Job',
          description: 'x'.repeat(60),
          skills: ['ts'],
          salary: 100,
          currency: 'VND',
          location: 'HN',
          jobType: 'FULL_TIME',
        },
        images: [
          {
            originalName: 'logo.png',
            buffer: Buffer.from('img'),
            mimetype: 'image/png',
            size: 100,
          },
        ],
        employerEmail: null,
      }),
    ).rejects.toThrow('write failed');

    expect(imageValidateMock).toHaveBeenCalledWith('image/png', 100);
    expect(imageSaveMock).toHaveBeenCalledWith('job-cleanup', 'logo.png', expect.any(Buffer));
    expect(imageDeleteMock).toHaveBeenCalledWith('job-cleanup', 'storage/job-cleanup/image.png');
    expect(queueAddMock).not.toHaveBeenCalled();
    expect(appendJobLogMock).not.toHaveBeenCalled();
  });
});
