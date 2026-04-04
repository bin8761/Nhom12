import express from 'express';
import request from 'supertest';

type MockUser = {
  id: string;
  role: 'CANDIDATE' | 'EMPLOYER';
  approvalStatus?: 'PENDING' | 'APPROVED';
};

const prismaMock = {
  job: {
    findUnique: jest.fn(),
  },
  candidateCv: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  application: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
};

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: () => prismaMock,
}));

let currentUser: MockUser = {
  id: 'cand-1',
  role: 'CANDIDATE',
};

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
  requireRole:
    (roles: string[]) =>
    (req: any, res: any, next: () => void) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ code: 'ERR_FORBIDDEN', message: 'Insufficient role permissions' });
      }
      return next();
    },
}));

jest.mock('../../middlewares/requireEmployerApproval', () => ({
  requireEmployerApproval: () => (_req: any, _res: any, next: () => void) => next(),
}));

const generateSignedUrlMock = jest.fn(() => ({
  token: 'signed-token',
  expiresAt: new Date('2025-12-01T00:00:00Z'),
}));

jest.mock('../../services/cv/cvStorageService', () => ({
  CVStorageService: jest.fn(() => ({
    generateSignedUrl: generateSignedUrlMock,
  })),
}));

jest.mock('../../events/jobEvents', () => ({
  publishCvDecisionEvent: jest.fn(),
}));

import publicJobsRouter from '../publicJobs.routes';
import employerJobsRouter from '../employerJobs.routes';
import type { CvReviewStatus } from '@prisma/client';

const authAccessModule = jest.requireMock('../../middlewares/authAccess') as {
  __setMockUser: (user: MockUser) => void;
};
const jobEventsModule = jest.requireMock('../../events/jobEvents') as {
  publishCvDecisionEvent: jest.Mock;
};

const app = express();
app.use(express.json());
app.use('/api/public-jobs', publicJobsRouter);
app.use('/api/jobs', employerJobsRouter);

const defaultApplicationResponse = {
  id: 'app-1',
  jobId: 'job-1',
  candidateId: 'cand-1',
  status: 'SUBMITTED',
  cvStatus: 'PENDING' as CvReviewStatus | null,
  cvSnapshot: { email: 'john@example.com' },
  createdAt: new Date('2025-11-15T00:00:00Z'),
  cvDecisionNote: null,
  cvReviewedAt: null,
};

describe('Application flow integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAccessModule.__setMockUser({ id: 'cand-1', role: 'CANDIDATE' });
    currentUser = { id: 'cand-1', role: 'CANDIDATE' };
  });

  describe('POST /api/public-jobs/:jobId/apply', () => {
    it('creates application when candidate has parsed CV', async () => {
      prismaMock.job.findUnique.mockResolvedValue({ id: 'job-1', status: 'APPROVED' });
      prismaMock.candidateCv.findFirst.mockResolvedValue({
        id: 'cv-1',
        candidateId: 'cand-1',
        status: 'PARSED',
        parsedFields: { email: 'john@example.com' },
        uploadedAt: new Date(),
      });
      prismaMock.application.create.mockResolvedValue({
        ...defaultApplicationResponse,
      });

      const response = await request(app)
        .post('/api/public-jobs/job-1/apply')
        .send({})
        .expect(201);

      expect(prismaMock.application.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          candidateId: 'cand-1',
          jobId: 'job-1',
          cvStatus: 'PENDING',
          cvSnapshot: { email: 'john@example.com' },
        }),
      });
      expect(response.body.data.cvSnapshot).toEqual({ email: 'john@example.com' });
      expect(response.body.data.cvStatus).toBe('PENDING');
    });

    it('returns 400 when candidate lacks parsed CV', async () => {
      prismaMock.job.findUnique.mockResolvedValue({ id: 'job-1', status: 'APPROVED' });
      prismaMock.candidateCv.findFirst.mockResolvedValue({
        id: 'cv-99',
        candidateId: 'cand-1',
        status: 'PENDING',
      });

      const response = await request(app)
        .post('/api/public-jobs/job-1/apply')
        .send({})
        .expect(400);

      expect(response.body.code).toBe('ERR_CV_REQUIRED');
      expect(prismaMock.application.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/jobs/:jobId/applications', () => {
    it('returns applications with cv_snapshot and download url', async () => {
      authAccessModule.__setMockUser({ id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' });
      currentUser = { id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' };

      prismaMock.job.findUnique.mockResolvedValue({ employerId: 'emp-1' });
      prismaMock.application.findMany.mockResolvedValue([defaultApplicationResponse]);
      prismaMock.application.count.mockResolvedValue(1);
      prismaMock.candidateCv.findMany.mockResolvedValue([
        { candidateId: 'cand-1', filePath: 'cand-1/cv.pdf' },
      ]);

      const response = await request(app).get('/api/jobs/job-1/applications').expect(200);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      const item = response.body.data[0];
      expect(item.cvSnapshot).toEqual({ email: 'john@example.com' });
      expect(item.cvDownloadUrl).toBe('/api/cv/download?token=signed-token');
      expect(item.cvDownloadUrlExpiresAt).toBe('2025-12-01T00:00:00.000Z');
      expect(response.body.meta.total).toBe(1);
    });

    it('returns 403 when employer tries to view another employer job', async () => {
      authAccessModule.__setMockUser({ id: 'emp-2', role: 'EMPLOYER', approvalStatus: 'APPROVED' });
      currentUser = { id: 'emp-2', role: 'EMPLOYER', approvalStatus: 'APPROVED' };

      prismaMock.job.findUnique.mockResolvedValue({ employerId: 'emp-1' });

      const response = await request(app).get('/api/jobs/job-1/applications').expect(403);

      expect(response.body.code).toBe('ERR_FORBIDDEN');
      expect(prismaMock.application.findMany).not.toHaveBeenCalled();
      expect(prismaMock.application.count).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/jobs/:jobId/applications/:applicationId/decision', () => {
    it('updates cv_status and publishes event', async () => {
      authAccessModule.__setMockUser({ id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' });
      currentUser = { id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' };

      prismaMock.job.findUnique.mockResolvedValue({ employerId: 'emp-1', title: 'Job' });
      prismaMock.application.findFirst.mockResolvedValue({
        id: 'app-1',
        candidateId: 'cand-1',
        cvStatus: 'PENDING',
      });
      prismaMock.application.update.mockResolvedValue({
        id: 'app-1',
        cvStatus: 'APPROVED',
        cvDecisionNote: 'Looks good',
        cvReviewedAt: new Date('2025-11-16T00:00:00Z'),
      });

      const response = await request(app)
        .post('/api/jobs/job-1/applications/app-1/decision')
        .send({ cvStatus: 'APPROVED', note: 'Looks good' })
        .expect(200);

      expect(prismaMock.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          cvStatus: 'APPROVED',
          cvDecisionNote: 'Looks good',
          cvReviewedAt: expect.any(Date),
        },
      });
      expect(response.body.data.cvStatus).toBe('APPROVED');
      expect(jobEventsModule.publishCvDecisionEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'APPROVED', applicationId: 'app-1' }),
      );
    });
  });
});
