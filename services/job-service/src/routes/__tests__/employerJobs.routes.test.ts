import request from 'supertest';
import express from 'express';

jest.mock('../../services/job.service', () => ({
  createJobWithImages: jest.fn(),
  listEmployerJobs: jest.fn(),
  getEmployerJobDetails: jest.fn(),
  updateJobWithImages: jest.fn(),
  deleteJob: jest.fn(),
}));

type MockUser = {
  id: string;
  email: string;
  role: string;
  approvalStatus: string;
};

const defaultUser: MockUser = {
  id: 'emp-1',
  email: 'employer@example.com',
  role: 'EMPLOYER',
  approvalStatus: 'APPROVED',
};

let currentUser: MockUser = { ...defaultUser };

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, _res, next) => {
    (req as any).user = currentUser;
    next();
  }),
  __setMockUser: (user: MockUser) => {
    currentUser = user;
  },
}));

jest.mock('../../middlewares/requireRole', () => ({
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

jest.mock('../../middlewares/requireEmployerApproval', () => ({
  requireEmployerApproval: () => (_req: any, _res: any, next: () => void) => next(),
}));

let blockRateLimit = false;

jest.mock('../../middlewares/rateLimit', () => ({
  jobPostRateLimiter: (req: any, res: any, next: () => void) => {
    if (blockRateLimit) {
      return res
        .status(429)
        .json({ code: 'ERR_RATE_LIMIT', message: 'Too many requests. Please try again later.' });
    }
    return next();
  },
  __setJobRateLimitBlocked: (blocked: boolean) => {
    blockRateLimit = blocked;
  },
}));

jest.mock('multer', () => {
  const multerMock = Object.assign(
    () =>
      ({
        array:
          () =>
          (req: any, _res: any, next: () => void) => {
            if (!Array.isArray(req.files)) {
              req.files = [];
            }
            next();
          },
      }) as any,
    {
      memoryStorage: jest.fn(() => ({})),
      MulterError: class MockMulterError extends Error {
        constructor(public code: string, public field?: string) {
          super(code);
        }
      },
    },
  );
  return multerMock;
});

import employerJobsRouter from '../employerJobs.routes';
import type * as jobServiceModule from '../../services/job.service';

type JobServiceModule = typeof jobServiceModule;
const jobService = jest.requireMock('../../services/job.service') as jest.Mocked<JobServiceModule>;
const authAccessModule = jest.requireMock('../../middlewares/authAccess') as {
  authAccess: jest.Mock;
  __setMockUser: (user: MockUser) => void;
};
const rateLimitModule = jest.requireMock('../../middlewares/rateLimit') as {
  __setJobRateLimitBlocked: (blocked: boolean) => void;
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/jobs', employerJobsRouter);

const baseJob = {
  id: 'job-1',
  employerId: 'emp-1',
  employerEmail: 'employer@example.com',
  title: 'Great backend engineer role',
  slug: 'great-backend-engineer-role',
  description: 'x'.repeat(60),
  skills: ['node', 'ts'],
  salary: 1200,
  currency: 'VND',
  location: 'Hanoi',
  jobType: 'FULL_TIME',
  provinceCode: 'VN-HN',
  provinceNameSnapshot: 'Ha Noi',
  districtCode: 'VN-HN-BA-DINH',
  districtNameSnapshot: 'Ba Dinh',
  addressLine: '123 Doi Can',
  status: 'PENDING',
  createdAt: new Date('2025-11-01T00:00:00Z'),
  updatedAt: new Date('2025-11-01T00:00:00Z'),
  publishedAt: null,
};

const baseImages = [
  {
    id: 'img-1',
    jobId: 'job-1',
    filePath: 'storage/job-1/img-1.png',
    slot: 0,
    createdAt: new Date('2025-11-01T00:00:00Z'),
  },
];

const buildValidPayload = () => ({
  title: 'Great backend engineer role',
  description: 'x'.repeat(60),
  skills: ['node', 'ts'],
  salary: 1200,
  currency: 'VND',
  location: 'Hanoi',
  jobType: 'FULL_TIME',
  provinceCode: 'VN-HN',
  districtCode: 'VN-HN-BA-DINH',
  addressLine: '123 Street',
});

describe('Employer jobs routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAccessModule.__setMockUser({ ...defaultUser });
    rateLimitModule.__setJobRateLimitBlocked(false);
  });

  describe('POST /api/jobs', () => {
    it('creates job successfully', async () => {
      jobService.createJobWithImages.mockResolvedValue({
        job: baseJob as any,
        images: baseImages as any,
        document: null,
      });

      const response = await request(app).post('/api/jobs').send(buildValidPayload()).expect(201);

      expect(response.body.data.id).toBe(baseJob.id);
      expect(jobService.createJobWithImages).toHaveBeenCalledWith(
        expect.objectContaining({
          employerId: defaultUser.id,
          actorId: defaultUser.id,
          payload: expect.objectContaining({ title: buildValidPayload().title }),
        }),
      );
    });

    it('returns validation error for invalid payload', async () => {
      await request(app)
        .post('/api/jobs')
        .send({ title: 'short', description: 'tiny' })
        .expect(400)
        .expect((res) => {
          expect(res.body.code).toBe('ERR_VALIDATION');
        });

      expect(jobService.createJobWithImages).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limit exceeds', async () => {
      rateLimitModule.__setJobRateLimitBlocked(true);

      await request(app).post('/api/jobs').send(buildValidPayload()).expect(429);

      expect(jobService.createJobWithImages).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/jobs/:jobId', () => {
    it('resets status to pending after edit', async () => {
      jobService.updateJobWithImages.mockResolvedValue({
        job: {
          ...baseJob,
          id: 'job-99',
          status: 'PENDING',
          updatedAt: new Date('2025-11-02T00:00:00Z'),
        } as any,
        images: [],
        document: null,
      });

      const payload = { description: 'y'.repeat(60) };

      const response = await request(app).put('/api/jobs/job-99').send(payload).expect(200);

      expect(jobService.updateJobWithImages).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-99',
          employerId: defaultUser.id,
          actorId: defaultUser.id,
        }),
      );
      expect(response.body.data.status).toBe('PENDING');
    });
  });

  describe('DELETE /api/jobs/:jobId', () => {
    it('performs soft delete', async () => {
      jobService.deleteJob.mockResolvedValue(undefined);

      await request(app).delete('/api/jobs/job-55').expect(204);

      expect(jobService.deleteJob).toHaveBeenCalledWith({
        employerId: defaultUser.id,
        actorId: defaultUser.id,
        jobId: 'job-55',
      });
    });
  });
});
    it('requires province code', async () => {
      await request(app)
        .post('/api/jobs')
        .send({ ...buildValidPayload(), provinceCode: undefined })
        .expect(400);

      expect(jobService.createJobWithImages).not.toHaveBeenCalled();
    });
