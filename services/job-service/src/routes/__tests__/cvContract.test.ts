import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import {
  applicationListResponseSchema,
  cvUploadResponseSchema,
  parsedFieldsSchema,
} from '../../contracts/apiSchemas';
import { resetAppConfigCache } from '../../config/appConfig';

const STORAGE_DIR = path.join(os.tmpdir(), 'cv-contract-tests');
process.env.CV_STORAGE_DIR = STORAGE_DIR;
process.env.CV_MAX_FILES_PER_CANDIDATE = '5';
process.env.CV_MAX_FILE_SIZE_BYTES = `${10 * 1024 * 1024}`;
process.env.CV_ALLOWED_MIME_TYPES = 'application/pdf';
process.env.CV_SIGNED_URL_TTL_SECONDS = '300';
process.env.CV_SIGNING_SECRET = 'contract-secret';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';
process.env.GEMINI_REQUEST_TIMEOUT_MS = '60000';

resetAppConfigCache();

type MockUser = {
  id: string;
  role: 'CANDIDATE' | 'EMPLOYER';
  approvalStatus?: 'PENDING' | 'APPROVED';
};

let currentUser: MockUser = { id: 'cand-1', role: 'CANDIDATE' };

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, _res, next) => {
    (req as any).user = currentUser;
    next();
  }),
  __setMockUser: (user: MockUser) => {
    currentUser = user;
  },
}));

type UploadBehavior = {
  fileFactory?: (() => Express.Multer.File) | null;
};

const uploadBehavior: UploadBehavior = {
  fileFactory: null,
};

jest.mock('../../middlewares/cvUpload', () => {
  return {
    cvUploadMiddleware: jest.fn((req, res, next) => {
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

jest.mock('../../services/cv/virusScanService', () => ({
  VirusScanService: jest.fn(() => ({
    scan: jest.fn(() => Promise.resolve(virusModule.result)),
  })),
}));

const queuedJobs: Array<{ cvId: string; candidateId: string; filePath: string }> = [];

jest.mock('../../services/cv/cvProcessingDispatcher', () => ({
  enqueueCvProcessingJob: jest.fn((payload) => {
    queuedJobs.push(payload);
    return Promise.resolve();
  }),
}));

const prismaMock = {
  candidateCv: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  job: {
    findUnique: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
};

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: () => prismaMock,
}));

import candidatesRouter from '../candidates.routes';
import employerJobsRouter from '../employerJobs.routes';

const candidatesApp = express();
candidatesApp.use(express.json());
candidatesApp.use('/api/candidates', candidatesRouter);

const employerApp = express();
employerApp.use(express.json());
employerApp.use('/api/jobs', employerJobsRouter);

const authModule = jest.requireMock('../../middlewares/authAccess') as {
  __setMockUser: (user: MockUser) => void;
};
const uploadModule = jest.requireMock('../../middlewares/cvUpload') as {
  __setUploadBehavior: (behavior: UploadBehavior) => void;
};
const schemaPath = path.resolve(
  process.cwd(),
  '..',
  '..',
  'docs',
  'schemas',
  'parsedFields.schema.json',
);

async function ensureStorageDir(): Promise<void> {
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

const tempUploads: string[] = [];

async function createUploadFile(content = 'PDF data'): Promise<Express.Multer.File> {
  const tempPath = path.join(os.tmpdir(), `cv-contract-${randomUUID()}.pdf`);
  await fs.writeFile(tempPath, content);
  tempUploads.push(tempPath);
  return {
    path: tempPath,
    mimetype: 'application/pdf',
    originalname: 'cv.pdf',
    size: Buffer.byteLength(content),
    fieldname: 'file',
    destination: path.dirname(tempPath),
    filename: path.basename(tempPath),
    encoding: '7bit',
    stream: undefined as any,
    buffer: Buffer.from(content),
  };
}

describe('CV API contract tests', () => {
  beforeAll(async () => {
    await ensureStorageDir();
  });

  afterEach(async () => {
    await ensureStorageDir();
    prismaMock.candidateCv.create.mockReset();
    prismaMock.candidateCv.findMany.mockReset();
    prismaMock.candidateCv.update.mockReset();
    prismaMock.job.findUnique.mockReset();
    prismaMock.application.findMany.mockReset();
    prismaMock.application.count.mockReset();
    prismaMock.$transaction.mockClear();
    authModule.__setMockUser({ id: 'cand-1', role: 'CANDIDATE' });
    uploadModule.__setUploadBehavior({ fileFactory: null });
    currentUser = { id: 'cand-1', role: 'CANDIDATE' };
    queuedJobs.splice(0);

    await Promise.all(
      tempUploads.splice(0).map((file) => fs.rm(file, { force: true }).catch(() => undefined)),
    );
  });

  it('returns upload response matching documented schema', async () => {
    const file = await createUploadFile('valid pdf payload');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });

    prismaMock.candidateCv.create.mockResolvedValue({
      id: 'cv-contract',
      candidateId: 'cand-1',
      status: 'PARSING',
      uploadedAt: new Date('2025-11-15T00:00:00Z'),
    });

    const response = await request(candidatesApp).post('/api/candidates/cand-1/cv').expect(202);

    expect(() => cvUploadResponseSchema.parse(response.body)).not.toThrow();
    expect(queuedJobs).toHaveLength(1);
  });

  it('returns application list response matching schema', async () => {
    authModule.__setMockUser({ id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' });
    currentUser = { id: 'emp-1', role: 'EMPLOYER', approvalStatus: 'APPROVED' };

    prismaMock.job.findUnique.mockResolvedValue({ employerId: 'emp-1' });
    prismaMock.application.findMany.mockResolvedValue([
      {
        id: 'app-1',
        candidateId: 'cand-1',
        status: 'SUBMITTED',
        cvStatus: 'PENDING',
        cvDecisionNote: null,
        cvReviewedAt: null,
        cvSnapshot: JSON.stringify({ fullName: 'John Doe', email: 'john@example.com', skills: ['node'] }),
        createdAt: new Date('2025-11-10T00:00:00Z'),
      },
    ]);
    prismaMock.application.count.mockResolvedValue(1);
    prismaMock.candidateCv.findMany.mockResolvedValue([
      { candidateId: 'cand-1', filePath: 'cand-1/cv.pdf' },
    ]);

    const response = await request(employerApp)
      .get('/api/jobs/job-1/applications')
      .expect(200);

    expect(() => applicationListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.data[0].cvSnapshot.fullName).toBe('John Doe');
  });

  it('keeps parsed_fields JSON schema in sync with Zod schema', async () => {
    const json = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
    const jsonKeys = Object.keys(json.properties ?? {});
    const zodKeys = Object.keys(parsedFieldsSchema.shape);
    expect(jsonKeys.sort()).toEqual(zodKeys.sort());

    const samplePayload = {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+8499999999',
      skills: ['node', 'ts'],
      yearsExperience: 5,
      education: [{ institution: 'ABC University', degree: 'CS', graduationYear: 2020 }],
      summary: 'Backend engineer',
    };
    expect(() => parsedFieldsSchema.parse(samplePayload)).not.toThrow();
  });
});
