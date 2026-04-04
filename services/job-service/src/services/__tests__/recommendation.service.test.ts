import { buildCandidateRecommendations, invalidateCandidateRecommendationCache } from '../recommendation.service';
import { searchApprovedJobsPublic } from '../job.service';

jest.mock('../job.service', () => ({
  searchApprovedJobsPublic: jest.fn(),
}));

jest.mock('../../infra/prisma/prismaClient', () => {
  const prismaMock = {
    candidate: {
      findUnique: jest.fn(),
    },
  };

  return {
    getPrismaClient: () => prismaMock,
    __mock: prismaMock,
  };
});

const { __mock: prismaMock } = jest.requireMock('../../infra/prisma/prismaClient') as {
  __mock: {
    candidate: {
      findUnique: jest.Mock;
    };
  };
};

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
};

jest.mock('../../container/appContext', () => ({
  getRedisConnection: () => redisMock,
}));

jest.mock('../../config/appConfig', () => ({
  loadAppConfig: jest.fn(() => ({
    recommendationCache: { ttlSeconds: 30 },
  })),
}));

const searchApprovedJobsPublicMock = searchApprovedJobsPublic as jest.Mock;

const job = (id: string) =>
  ({
    id,
    employerId: 'emp',
    title: id,
    slug: id,
    description: id,
    skills: [],
    salary: 0,
    currency: 'VND',
    location: 'HN',
    jobType: 'FULL_TIME',
    status: 'APPROVED',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    provinceCode: 'VN-HN',
    provinceNameSnapshot: 'HN',
    addressLine: '123',
    images: [],
  }) as any;

describe('buildCandidateRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.candidate.findUnique.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.keys.mockReset();
    redisMock.del.mockReset();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    redisMock.keys.mockResolvedValue([]);
    redisMock.del.mockResolvedValue(0);
    searchApprovedJobsPublicMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      filtersApplied: {},
    });
  });

  it('returns missing_location when no preference', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      preferredProvinceCode: null,
    });

    const result = await buildCandidateRecommendations({ candidateId: 'cand' });

    expect(result.data).toHaveLength(0);
    expect(result.meta.reason).toBe('missing_location');
    expect(searchApprovedJobsPublicMock).not.toHaveBeenCalled();
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('uses province results and stops when limit satisfied', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      preferredProvinceCode: 'VN-HCM',
    });
    searchApprovedJobsPublicMock.mockResolvedValueOnce({
      data: [job('job-1'), job('job-2')],
      pagination: { page: 1, limit: 2, total: 2, totalPages: 1 },
      filtersApplied: {},
    });

    const result = await buildCandidateRecommendations({ candidateId: 'cand', limit: 2 });

    expect(result.data.map((item) => item.id)).toEqual(['job-1', 'job-2']);
    expect(result.meta.reason).toBe('province');
    expect(searchApprovedJobsPublicMock).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      'job-rec:cand:2:publishedAt_desc',
      expect.any(String),
      'EX',
      30,
    );
  });

  it('falls back to global when needed', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      preferredProvinceCode: 'VN-HCM',
    });

    searchApprovedJobsPublicMock
      .mockResolvedValueOnce({
        data: [job('job-1'), job('job-2')],
        pagination: { page: 1, limit: 3, total: 2, totalPages: 1 },
        filtersApplied: {},
      })
      .mockResolvedValueOnce({
        data: [job('job-3')],
        pagination: { page: 1, limit: 3, total: 1, totalPages: 1 },
        filtersApplied: {},
      });

    const result = await buildCandidateRecommendations({ candidateId: 'cand', limit: 3, includeGlobal: true });

    expect(result.data.map((item) => item.id)).toEqual(['job-1', 'job-2', 'job-3']);
    expect(result.meta.reason).toBe('province');
    expect(searchApprovedJobsPublicMock).toHaveBeenCalledTimes(2);
  });

  it('reports province reason when province has results', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      preferredProvinceCode: 'VN-HN',
    });

    searchApprovedJobsPublicMock.mockResolvedValueOnce({
      data: [job('job-5')],
      pagination: { page: 1, limit: 2, total: 1, totalPages: 1 },
      filtersApplied: {},
    });

    const result = await buildCandidateRecommendations({ candidateId: 'cand', limit: 2 });

    expect(result.data.map((item) => item.id)).toEqual(['job-5']);
    expect(result.meta.reason).toBe('province');
    expect(searchApprovedJobsPublicMock).toHaveBeenCalledTimes(1);
  });

  it('returns cached recommendation when redis hit', async () => {
    prismaMock.candidate.findUnique.mockResolvedValue({
      preferredProvinceCode: 'VN-HCM',
    });
    const cachedPayload = {
      data: [
        {
          ...job('job-cache'),
          createdAt: new Date('2025-11-01T00:00:00Z').toISOString(),
          updatedAt: new Date('2025-11-02T00:00:00Z').toISOString(),
          publishedAt: new Date('2025-11-03T00:00:00Z').toISOString(),
          images: [
            {
              id: 'img-1',
              jobId: 'job-cache',
              filePath: 'path',
              slot: 0,
              createdAt: new Date('2025-11-01T00:00:00Z').toISOString(),
            },
          ],
        },
      ],
      meta: {
        limit: 10,
        sort: 'publishedAt_desc' as const,
        filters: {
          provinceCode: 'VN-HCM',
        },
        reason: 'province' as const,
      },
    };
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cachedPayload));

    const result = await buildCandidateRecommendations({ candidateId: 'cand' });

    expect(searchApprovedJobsPublicMock).not.toHaveBeenCalled();
    expect(result.data[0].id).toBe('job-cache');
    expect(result.data[0].createdAt).toBeInstanceOf(Date);
    expect(redisMock.set).not.toHaveBeenCalled();
  });
});

describe('invalidateCandidateRecommendationCache', () => {
  beforeEach(() => {
    redisMock.keys.mockReset();
    redisMock.del.mockReset();
  });

  it('deletes cached keys for candidate', async () => {
    redisMock.keys.mockResolvedValueOnce([
      'job-rec:cand:10:publishedAt_desc',
      'job-rec:cand:5:salary_desc',
    ]);
    redisMock.del.mockResolvedValueOnce(2);

    await invalidateCandidateRecommendationCache('cand');

    expect(redisMock.keys).toHaveBeenCalledWith('job-rec:cand:*');
    expect(redisMock.del).toHaveBeenCalledWith(
      'job-rec:cand:10:publishedAt_desc',
      'job-rec:cand:5:salary_desc',
    );
  });
});
