import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { resetAppConfigCache } from '../config/appConfig';
import type { CvProcessingJobPayload } from '../jobs/cvProcessingQueue';

const STORAGE_DIR = path.join(os.tmpdir(), 'cv-happy-path-e2e');
process.env.CV_STORAGE_DIR = STORAGE_DIR;
process.env.CV_MAX_FILES_PER_CANDIDATE = '5';
process.env.CV_MAX_FILE_SIZE_BYTES = `${10 * 1024 * 1024}`;
process.env.CV_ALLOWED_MIME_TYPES = 'application/pdf';
process.env.CV_SIGNED_URL_TTL_SECONDS = '600';
process.env.CV_SIGNING_SECRET = 'happy-path-secret';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';
process.env.GEMINI_REQUEST_TIMEOUT_MS = '60000';

resetAppConfigCache();

type MockUser = {
  id: string;
  role: 'CANDIDATE' | 'EMPLOYER';
  approvalStatus?: 'APPROVED' | 'PENDING';
};

let currentUser: MockUser = { id: 'cand-1', role: 'CANDIDATE' };

jest.mock('../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, _res, next) => {
    (req as any).user = currentUser;
    next();
  }),
  __setMockUser: (user: MockUser) => {
    currentUser = user;
  },
}));

jest.mock('../middlewares/requireRole', () => ({
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

jest.mock('../middlewares/requireEmployerApproval', () => ({
  requireEmployerApproval: () => (_req: any, res: any, next: () => void) => {
    if ((currentUser.approvalStatus ?? 'PENDING') !== 'APPROVED') {
      return res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Employer not approved' });
    }
    next();
  },
}));

type UploadBehavior = {
  fileFactory?: (() => Express.Multer.File) | null;
};

const uploadBehavior: UploadBehavior = {
  fileFactory: null,
};

jest.mock('../middlewares/cvUpload', () => {
  return {
    cvUploadMiddleware: jest.fn((req, _res, next) => {
      if (uploadBehavior.fileFactory) {
        req.file = uploadBehavior.fileFactory();
      }
      next();
    }),
    cvUploadRateLimiter: jest.fn((_req, _res, next) => next()),
    __setUploadBehavior: (behavior: UploadBehavior) => {
      uploadBehavior.fileFactory = behavior.fileFactory ?? null;
    },
  };
});

const virusModule = {
  result: { isInfected: false as boolean, viruses: undefined as string[] | undefined },
};

jest.mock('../services/cv/virusScanService', () => ({
  VirusScanService: jest.fn(() => ({
    scan: jest.fn(() => Promise.resolve(virusModule.result)),
  })),
}));

const publishCvDecisionEvent = jest.fn();

jest.mock('../events/jobEvents', () => ({
  publishCvDecisionEvent: jest.fn((payload) => publishCvDecisionEvent(payload)),
}));

const queuedJobs: CvProcessingJobPayload[] = [];

jest.mock('../services/cv/cvProcessingDispatcher', () => ({
  enqueueCvProcessingJob: jest.fn((payload) => {
    queuedJobs.push(payload);
    return Promise.resolve();
  }),
}));

interface CandidateCvRecord {
  id: string;
  candidateId: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED';
  parsedFields: Record<string, unknown> | null;
  uploadedAt: Date;
  processedAt: Date | null;
}

interface ApplicationRecord {
  id: string;
  jobId: string;
  candidateId: string;
  status: string;
  cvStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  cvDecisionNote: string | null;
  cvReviewedAt: Date | null;
  cvSnapshot: Record<string, unknown> | null;
  createdAt: Date;
}

const db = {
  candidateCvs: [] as CandidateCvRecord[],
  applications: [] as ApplicationRecord[],
  jobs: [
    {
      id: 'job-123',
      employerId: 'emp-1',
      status: 'APPROVED',
      title: 'Backend Engineer',
    },
  ],
};

const prismaMock = {
  candidateCv: {
    create: jest.fn(async ({ data }) => {
      const record: CandidateCvRecord = {
        id: data.id ?? `cv-${randomUUID()}`,
        candidateId: data.candidateId,
        filePath: data.filePath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        status: data.status,
        parsedFields: null,
        uploadedAt: data.uploadedAt ?? new Date(),
        processedAt: null,
      };
      db.candidateCvs.push(record);
      return record;
    }),
    findFirst: jest.fn(async ({ where, orderBy }) => {
      const records = db.candidateCvs
        .filter((cv) => (!where?.candidateId || cv.candidateId === where.candidateId))
        .filter((cv) => (!where?.status || cv.status === where.status));
      if (!records.length) {
        return null;
      }
      if (orderBy?.uploadedAt === 'desc') {
        return records.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
      }
      return records[0];
    }),
    findMany: jest.fn(async ({ where }) => {
      if (!where?.candidateId?.in) {
        return [];
      }
      const ids: string[] = where.candidateId.in;
      const matches = db.candidateCvs
        .filter((cv) => ids.includes(cv.candidateId))
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      const unique = new Map<string, CandidateCvRecord>();
      for (const record of matches) {
        if (!unique.has(record.candidateId)) {
          unique.set(record.candidateId, record);
        }
      }
      return [...unique.values()].map((record) => ({
        candidateId: record.candidateId,
        filePath: record.filePath,
      }));
    }),
    update: jest.fn(async ({ where, data }) => {
      const record = db.candidateCvs.find((cv) => cv.id === where.id);
      if (!record) {
        throw new Error('CV not found');
      }
      const nextData = { ...data };
      if (typeof nextData.parsedFields === 'string') {
        try {
          nextData.parsedFields = JSON.parse(nextData.parsedFields);
        } catch {
          nextData.parsedFields = null;
        }
      }
      Object.assign(record, nextData);
      return record;
    }),
  },
  job: {
    findUnique: jest.fn(async ({ where }) => db.jobs.find((job) => job.id === where.id) ?? null),
  },
  application: {
    create: jest.fn(async ({ data }) => {
      const application: ApplicationRecord = {
        id: data.id ?? `app-${randomUUID()}`,
        jobId: data.jobId,
        candidateId: data.candidateId,
        status: data.status,
        cvStatus: data.cvStatus ?? 'PENDING',
        cvDecisionNote: data.cvDecisionNote ?? null,
        cvReviewedAt: data.cvReviewedAt ?? null,
        cvSnapshot: data.cvSnapshot ?? null,
        createdAt: data.createdAt ?? new Date(),
      };
      db.applications.push(application);
      return application;
    }),
    findMany: jest.fn(async ({ where }) =>
      db.applications
        .filter((app) => app.jobId === where.jobId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    ),
    count: jest.fn(async ({ where }) => db.applications.filter((app) => app.jobId === where.jobId).length),
    findFirst: jest.fn(async ({ where }) =>
      db.applications.find((app) => app.id === where.id && app.jobId === where.jobId) ?? null,
    ),
    update: jest.fn(async ({ where, data }) => {
      const application = db.applications.find((app) => app.id === where.id);
      if (!application) {
        throw new Error('Application not found');
      }
      Object.assign(application, data);
      return application;
    }),
  },
  $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
};

jest.mock('../infra/prisma/prismaClient', () => ({
  getPrismaClient: () => prismaMock,
}));

import candidatesRouter from '../routes/candidates.routes';
import publicJobsRouter from '../routes/publicJobs.routes';
import employerJobsRouter from '../routes/employerJobs.routes';

const authModule = jest.requireMock('../middlewares/authAccess') as {
  __setMockUser: (user: MockUser) => void;
};
const uploadModule = jest.requireMock('../middlewares/cvUpload') as {
  __setUploadBehavior: (behavior: UploadBehavior) => void;
};

const app = express();
app.use(express.json());
app.use('/api/candidates', candidatesRouter);
app.use('/api/public-jobs', publicJobsRouter);
app.use('/api/jobs', employerJobsRouter);

async function ensureStorageDir(): Promise<void> {
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

const tempUploads: string[] = [];

async function createUploadFile(content = 'PDF content'): Promise<Express.Multer.File> {
  const filePath = path.join(os.tmpdir(), `cv-happy-${randomUUID()}.pdf`);
  await fs.writeFile(filePath, content);
  tempUploads.push(filePath);
  return {
    path: filePath,
    mimetype: 'application/pdf',
    originalname: 'resume.pdf',
    size: Buffer.byteLength(content),
    fieldname: 'file',
    destination: path.dirname(filePath),
    filename: path.basename(filePath),
    encoding: '7bit',
    stream: undefined as any,
    buffer: Buffer.from(content),
  };
}

async function simulateWorkerProcessing(payload: CvProcessingJobPayload): Promise<void> {
  const record = db.candidateCvs.find((cv) => cv.id === payload.cvId);
  if (!record) {
    throw new Error('CV not found in mock DB');
  }
  record.status = 'PARSED';
  record.parsedFields = {
    fullName: 'Jane Candidate',
    email: 'jane@example.com',
    skills: ['node', 'ts'],
    yearsExperience: 5,
  };
  record.processedAt = new Date();
}

describe('CV pipeline end-to-end happy path', () => {
  beforeAll(async () => {
    await ensureStorageDir();
  });

  afterEach(async () => {
    await ensureStorageDir();
    db.candidateCvs.splice(0);
    db.applications.splice(0);
    queuedJobs.splice(0);
    publishCvDecisionEvent.mockReset();
    authModule.__setMockUser({ id: 'cand-1', role: 'CANDIDATE' });
    uploadModule.__setUploadBehavior({ fileFactory: null });
    currentUser = { id: 'cand-1', role: 'CANDIDATE' };
    virusModule.result = { isInfected: false, viruses: undefined };
    await Promise.all(
      tempUploads.splice(0).map((file) => fs.rm(file, { force: true }).catch(() => undefined)),
    );
  });

  it('covers upload → AI parse → apply → employer review → decision', async () => {
    // Candidate uploads CV
    const file = await createUploadFile('candidate pdf');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });
    const uploadRes = await request(app).post('/api/candidates/cand-1/cv').expect(202);
    expect(uploadRes.body.data.status).toBe('PARSING');
    expect(queuedJobs).toHaveLength(1);

    await simulateWorkerProcessing(queuedJobs.shift()!);
    const processedCv = db.candidateCvs.find((cv) => cv.id === uploadRes.body.data.cvId);
    expect(processedCv?.status).toBe('PARSED');
    expect(processedCv?.parsedFields?.email).toBe('jane@example.com');

    // Candidate applies to job
    authModule.__setMockUser({ id: 'cand-1', role: 'CANDIDATE' });
    currentUser = { id: 'cand-1', role: 'CANDIDATE' };
    const applyRes = await request(app)
      .post('/api/public-jobs/job-123/apply')
      .send({})
      .expect(201);
    const applicationId = applyRes.body.data.id;
    expect(applyRes.body.data.cvSnapshot.email).toBe('jane@example.com');

    // Employer views applications
    authModule.__setMockUser({ id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' });
    currentUser = { id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' };
    const listRes = await request(app).get('/api/jobs/job-123/applications').expect(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].cvSnapshot.email).toBe('jane@example.com');
    expect(listRes.body.data[0].cvDownloadUrl).toContain('/api/cv/download');

    // Employer approves CV
    const decisionRes = await request(app)
      .post(`/api/jobs/job-123/applications/${applicationId}/decision`)
      .send({ cvStatus: 'APPROVED', note: 'Looks great' })
      .expect(200);
    expect(decisionRes.body.data.cvStatus).toBe('APPROVED');
    expect(publishCvDecisionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId,
        jobId: 'job-123',
        candidateId: 'cand-1',
        status: 'APPROVED',
      }),
    );
  });
});
