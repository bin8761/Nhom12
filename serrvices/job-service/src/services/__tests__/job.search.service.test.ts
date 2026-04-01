import type { Prisma } from '@prisma/client';
import { searchApprovedJobsPublic } from '../job.service';

const prismaMock = {
  job: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(async (operations: any) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    return operations;
  }),
} as unknown as Prisma.TransactionClient & {
  job: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
};

const redisMock = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
};

const configModule = jest.requireActual('../../config/appConfig');

let ttlSeconds = 30;

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: () => prismaMock,
}));

jest.mock('../../container/appContext', () => ({
  getRedisConnection: () => redisMock,
  getJobApprovalQueueContext: jest.fn(),
}));

jest.mock('../../config/appConfig', () => ({
  loadAppConfig: jest.fn(() => ({
    ...configModule.loadAppConfig(),
    searchCache: {
      ttlSeconds,
      locationSeedVersion: null,
    },
  })),
}));

jest.mock('../../metrics/jobMetrics', () => ({
  recordSearchCache: jest.fn(),
}));

const recordSearchCacheMock = jest.requireMock('../../metrics/jobMetrics')
  .recordSearchCache as jest.Mock;

describe('searchApprovedJobsPublic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ttlSeconds = 30;
    prismaMock.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        employerId: 'emp',
        title: 'Backend',
        slug: 'backend',
        description: 'desc',
        skills: [],
        salary: 1000,
        currency: 'VND',
        location: 'HN',
        jobType: 'FULL_TIME',
        status: 'APPROVED',
        publishedAt: new Date('2025-11-10T00:00:00Z'),
        createdAt: new Date('2025-11-09T00:00:00Z'),
        updatedAt: new Date('2025-11-11T00:00:00Z'),
        images: [],
        provinceCode: 'VN-HN',
        districtCode: 'VN-HN-BA-DINH',
        provinceNameSnapshot: 'Ha Noi',
        districtNameSnapshot: 'Ba Dinh',
        addressLine: '123 street',
      },
    ]);
    prismaMock.job.count.mockResolvedValue(1);
    prismaMock.job.findFirst.mockResolvedValue({
      updatedAt: new Date('2025-11-11T00:00:00Z'),
    });
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
  });

  it('returns cached payload when available', async () => {
    redisMock.get.mockResolvedValueOnce(
      JSON.stringify({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        filtersApplied: {},
      }),
    );

    const result = await searchApprovedJobsPublic({ page: 1, limit: 10 });

    expect(prismaMock.job.findMany).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(recordSearchCacheMock).toHaveBeenCalledWith('hit');
  });

  it('queries database, caches result, and applies filters', async () => {
    const result = await searchApprovedJobsPublic({
      page: 1,
      limit: 10,
      provinceCode: 'VN-HN',
      jobType: 'FULL_TIME',
      q: 'backend',
      sort: 'salary_desc',
    });

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provinceCode: 'VN-HN',
        }),
      }),
    );
    expect(redisMock.set).toHaveBeenCalled();
    expect(recordSearchCacheMock).toHaveBeenCalledWith('miss');
    expect(result.filtersApplied.q).toBe('backend');
    expect(result.data).toHaveLength(1);
  });

  it('skips cache when ttl is zero', async () => {
    ttlSeconds = 0;
    await searchApprovedJobsPublic({ page: 1, limit: 5 });
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });
});
