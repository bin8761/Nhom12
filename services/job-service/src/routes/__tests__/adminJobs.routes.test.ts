import express from 'express';
import request from 'supertest';

jest.mock('../../services/job.service', () => ({
  listJobsForAdmin: jest.fn(),
  approveJob: jest.fn(),
  rejectJob: jest.fn(),
}));

jest.mock('../../infra/email/smtpMailer', () => ({
  sendJobApprovedEmail: jest.fn(() => Promise.resolve()),
  sendJobRejectedEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../events/jobEvents', () => ({
  publishJobApprovedEvent: jest.fn(() => Promise.resolve()),
  publishJobRejectedEvent: jest.fn(() => Promise.resolve()),
}));

type MockUser =
  | {
      id: string;
      email: string;
      role: string;
      approvalStatus: string;
    }
  | null;

let currentUser: MockUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN',
  approvalStatus: 'APPROVED',
};

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    }
    (req as any).user = currentUser;
    return next();
  }),
  __setMockUser: (user: MockUser) => {
    currentUser = user;
  },
}));

jest.mock('../../middlewares/requireRole', () => ({
  requireRole:
    (roles: string[]) =>
    (req: any, res: any, next: () => void) => {
      if (!currentUser || !roles.includes(currentUser.role)) {
        return res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Insufficient role' });
      }
      (req as any).user = currentUser;
      return next();
    },
}));

import adminJobsRouter from '../adminJobs.routes';
import type * as jobServiceModule from '../../services/job.service';
import type * as mailerModule from '../../infra/email/smtpMailer';
import type * as eventModule from '../../events/jobEvents';

const jobService = jest.requireMock('../../services/job.service') as jest.Mocked<typeof jobServiceModule>;
const mailer = jest.requireMock('../../infra/email/smtpMailer') as jest.Mocked<typeof mailerModule>;
const events = jest.requireMock('../../events/jobEvents') as jest.Mocked<typeof eventModule>;
const authAccessMock = jest.requireMock('../../middlewares/authAccess') as {
  __setMockUser: (user: MockUser) => void;
};

const app = express();
app.use(express.json());
app.use('/api/admin/jobs', adminJobsRouter);

const baseJob = {
  id: 'job-admin-1',
  employerId: 'emp-1',
  employerEmail: 'employer@example.com',
  title: 'Senior Backend Engineer',
  slug: 'senior-backend-engineer',
  status: 'PENDING',
  jobType: 'FULL_TIME',
  location: 'Hanoi',
  createdAt: new Date('2025-11-01T00:00:00Z'),
  updatedAt: new Date('2025-11-01T00:00:00Z'),
  publishedAt: null,
};

describe('Admin jobs routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAccessMock.__setMockUser({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
      approvalStatus: 'APPROVED',
    });
  });

  describe('POST /api/admin/jobs/:jobId/approve', () => {
    it('approves job and triggers email + event + audit', async () => {
      jobService.approveJob.mockResolvedValue({
        ...baseJob,
        status: 'APPROVED',
        publishedAt: new Date('2025-11-02T00:00:00Z'),
      } as any);

      const response = await request(app)
        .post('/api/admin/jobs/job-admin-1/approve')
        .send({ note: 'Looks good' })
        .expect(200);

      expect(jobService.approveJob).toHaveBeenCalledWith({
        jobId: 'job-admin-1',
        actorId: 'admin-1',
        note: 'Looks good',
      });
      expect(mailer.sendJobApprovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: baseJob.employerEmail }),
      );
      expect(events.publishJobApprovedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: baseJob.id }),
      );
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('returns 401 when auth middleware blocks', async () => {
      authAccessMock.__setMockUser(null);

      await request(app).post('/api/admin/jobs/job-admin-1/approve').send({ note: 'ok' }).expect(401);

      expect(jobService.approveJob).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/jobs/:jobId/reject', () => {
    it('rejects job and records note, email, event', async () => {
      jobService.rejectJob.mockResolvedValue({
        ...baseJob,
        status: 'REJECTED',
      } as any);

      const response = await request(app)
        .post('/api/admin/jobs/job-admin-1/reject')
        .send({ note: 'Incomplete description' })
        .expect(200);

      expect(jobService.rejectJob).toHaveBeenCalledWith({
        jobId: 'job-admin-1',
        actorId: 'admin-1',
        note: 'Incomplete description',
      });
      expect(mailer.sendJobRejectedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Incomplete description' }),
      );
      expect(events.publishJobRejectedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: baseJob.id, reason: 'Incomplete description' }),
      );
      expect(response.body.data.status).toBe('REJECTED');
      expect(response.body.data.rejectionNote).toBe('Incomplete description');
    });

    it('fails validation when note missing', async () => {
      await request(app).post('/api/admin/jobs/job-admin-1/reject').send({}).expect(400);

      expect(jobService.rejectJob).not.toHaveBeenCalled();
    });

    it('returns 403 when user lacks ADMIN role', async () => {
      authAccessMock.__setMockUser({
        id: 'emp-2',
        email: 'user@example.com',
        role: 'EMPLOYER',
        approvalStatus: 'APPROVED',
      });

      await request(app)
        .post('/api/admin/jobs/job-admin-1/reject')
        .send({ note: 'Some reason' })
        .expect(403);

      expect(jobService.rejectJob).not.toHaveBeenCalled();
    });
  });
});
