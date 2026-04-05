import request from 'supertest';
import express from 'express';

jest.mock('../../services/job.service', () => ({
  searchApprovedJobsPublic: jest.fn(),
}));

let throttleSearch = false;

jest.mock('../../middlewares/rateLimit', () => ({
  publicSearchRateLimiter: (req: any, res: any, next: () => void) => {
    if (throttleSearch) {
      return res
        .status(429)
        .json({ code: 'ERR_RATE_LIMIT', message: 'Too many requests. Please try again later.' });
    }
    return next();
  },
}));

const publicJobsRouter = require('../publicJobs.routes').default;
const jobService = jest.requireMock('../../services/job.service') as {
  searchApprovedJobsPublic: jest.Mock;
};

const app = express();
app.use(express.json());
app.use('/api/public/jobs', publicJobsRouter);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.statusCode ?? 500;
  res.status(status).json({
    code: err?.code ?? 'ERR_INTERNAL',
    message: err?.message ?? 'Internal error',
  });
});

const sampleJob = {
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
  provinceCode: 'VN-HN',
  provinceNameSnapshot: 'Ha Noi',
  districtCode: 'VN-HN-BA-DINH',
  districtNameSnapshot: 'Ba Dinh',
  addressLine: '123 street',
  status: 'APPROVED',
  publishedAt: new Date('2025-11-10T00:00:00Z'),
  createdAt: new Date('2025-11-09T00:00:00Z'),
  updatedAt: new Date('2025-11-11T00:00:00Z'),
  images: [],
};

describe('Public jobs search routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    throttleSearch = false;
    jobService.searchApprovedJobsPublic.mockResolvedValue({
      data: [sampleJob],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      filtersApplied: { q: 'node' },
    });
  });

  it('returns search results with filters applied', async () => {
    const response = await request(app).get('/api/public/jobs/search?q=node&page=1&limit=5').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.filtersApplied.q).toBe('node');
    expect(jobService.searchApprovedJobsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'node',
        limit: 5,
      }),
    );
  });

  it('enforces validation on short keywords', async () => {
    await request(app).get('/api/public/jobs/search?q=x').expect(400);
    expect(jobService.searchApprovedJobsPublic).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    throttleSearch = true;
    await request(app).get('/api/public/jobs/search?q=node').expect(429);
    expect(jobService.searchApprovedJobsPublic).not.toHaveBeenCalled();
  });
});
