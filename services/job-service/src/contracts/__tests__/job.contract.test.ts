import express from 'express';
import request from 'supertest';
import { jobDetailResponseSchema, jobListingResponseSchema } from '../job.contract';

jest.mock('../../services/job.service', () => ({
  listEmployerJobs: jest.fn(),
  getEmployerJobDetails: jest.fn(),
}));

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, _res, next) => {
    (req as any).user = {
      id: 'emp-1',
      role: 'EMPLOYER',
      approvalStatus: 'APPROVED',
    };
    next();
  }),
}));

jest.mock('../../middlewares/requireRole', () => ({
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

jest.mock('../../middlewares/requireEmployerApproval', () => ({
  requireEmployerApproval: () => (_req: any, _res: any, next: () => void) => next(),
}));

jest.mock('../../middlewares/rateLimit', () => ({
  jobPostRateLimiter: () => (_req: any, _res: any, next: () => void) => next(),
}));

const jobService = jest.requireMock('../../services/job.service') as jest.Mocked<{
  listEmployerJobs: jest.Mock;
  getEmployerJobDetails: jest.Mock;
}>;

import employerJobsRouter from '../../routes/employerJobs.routes';

const app = express();
app.use(express.json());
app.use('/api/jobs', employerJobsRouter);

const baseJob = {
  id: 'job-1',
  employerId: 'emp-1',
  title: 'Great backend role',
  slug: 'great-backend-role',
  description: 'x'.repeat(60),
  skills: ['node', 'ts'],
  salary: 1500,
  currency: 'VND',
  location: 'Hanoi',
  jobType: 'FULL_TIME',
  status: 'PENDING',
  createdAt: new Date('2025-11-01T00:00:00Z'),
  updatedAt: new Date('2025-11-01T00:00:00Z'),
  publishedAt: null,
  images: [
    {
      id: 'img-1',
      jobId: 'job-1',
      filePath: 'storage/job-1/img-1.png',
      slot: 0,
      createdAt: new Date('2025-11-01T00:00:00Z'),
    },
  ],
};

describe('Job contract responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches job listing schema', async () => {
    jobService.listEmployerJobs.mockResolvedValue({
      data: [baseJob],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });

    const response = await request(app).get('/api/jobs').expect(200);
    expect(() => jobListingResponseSchema.parse(response.body)).not.toThrow();
  });

  it('matches job detail schema', async () => {
    jobService.getEmployerJobDetails.mockResolvedValue({
      ...baseJob,
      approvalLogs: [
        {
          id: 'log-1',
          action: 'SUBMITTED',
          performedBy: 'emp-1',
          note: null,
          createdAt: new Date('2025-11-01T00:00:00Z'),
        },
      ],
    });

    const response = await request(app).get('/api/jobs/job-1').expect(200);
    expect(() => jobDetailResponseSchema.parse(response.body)).not.toThrow();
  });
});
