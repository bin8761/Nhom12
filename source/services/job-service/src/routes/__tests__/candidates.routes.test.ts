import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { resetAppConfigCache } from '../../config/appConfig';

const STORAGE_DIR = path.join(os.tmpdir(), 'cv-upload-route-tests');
process.env.CV_STORAGE_DIR = STORAGE_DIR;
process.env.CV_MAX_FILES_PER_CANDIDATE = '5';
process.env.CV_MAX_FILE_SIZE_BYTES = `${10 * 1024 * 1024}`;
process.env.CV_ALLOWED_MIME_TYPES = 'application/pdf';
process.env.CV_SIGNED_URL_TTL_SECONDS = '300';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';
process.env.GEMINI_REQUEST_TIMEOUT_MS = '60000';

resetAppConfigCache();

let currentUser = { id: 'cand-1', role: 'CANDIDATE' as const };

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: jest.fn((req, _res, next) => {
    (req as any).user = currentUser;
    next();
  }),
  __setMockUser: (user: typeof currentUser) => {
    currentUser = user;
  },
}));

type UploadBehavior = {
  fileFactory?: (() => Express.Multer.File) | null;
  respondWith?: { status: number; body: any } | null;
  rateLimited?: boolean;
  rateLimitAfter?: number | null;
};

const uploadBehavior: UploadBehavior = {
  fileFactory: null,
  respondWith: null,
  rateLimited: false,
  rateLimitAfter: null,
};
let rateLimitCounter = 0;

jest.mock('../../middlewares/cvUpload', () => {
  return {
    cvUploadMiddleware: jest.fn((req, res, next) => {
      if (uploadBehavior.respondWith) {
        res
          .status(uploadBehavior.respondWith.status)
          .json(uploadBehavior.respondWith.body);
        return;
      }
      if (uploadBehavior.fileFactory) {
        req.file = uploadBehavior.fileFactory();
      }
      next();
    }),
    cvUploadRateLimiter: jest.fn((req, res, next) => {
      if (uploadBehavior.rateLimited) {
        res.status(429).json({
          code: 'ERR_RATE_LIMIT',
          message: 'Too many requests. Please try again later.',
        });
        return;
      }
      if (typeof uploadBehavior.rateLimitAfter === 'number') {
        rateLimitCounter += 1;
        if (rateLimitCounter > uploadBehavior.rateLimitAfter) {
          res.status(429).json({
            code: 'ERR_RATE_LIMIT',
            message: 'Too many requests. Please try again later.',
          });
          return;
        }
      }
      next();
    }),
    __setUploadBehavior: (input: UploadBehavior) => {
      uploadBehavior.fileFactory = input.fileFactory ?? null;
      uploadBehavior.respondWith = input.respondWith ?? null;
      uploadBehavior.rateLimited = input.rateLimited ?? false;
      uploadBehavior.rateLimitAfter =
        typeof input.rateLimitAfter === 'number' ? input.rateLimitAfter : null;
      rateLimitCounter = 0;
    },
  };
});

const virusModule = {
  result: { isInfected: false as boolean, viruses: undefined as string[] | undefined },
};

jest.mock('../../services/cv/virusScanService', () => {
  return {
    VirusScanService: jest.fn(() => ({
      scan: jest.fn(() => Promise.resolve(virusModule.result)),
    })),
  };
});

const prismMock = {
  candidateCv: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: () => prismMock,
}));

jest.mock('../../services/candidate.service', () => ({
  updateCandidateLocationPreference: jest.fn(),
}));

jest.mock('../../services/recommendation.service', () => ({
  buildCandidateRecommendations: jest.fn(),
  invalidateCandidateRecommendationCache: jest.fn(),
}));

let blockRecommendationRequests = false;

jest.mock('../../middlewares/rateLimit', () => ({
  jobPostRateLimiter: (_req: any, _res: any, next: () => void) => next(),
  publicSearchRateLimiter: (_req: any, _res: any, next: () => void) => next(),
  candidateRecommendationRateLimiter: (req: any, res: any, next: () => void) => {
    if (blockRecommendationRequests) {
      return res
        .status(429)
        .json({ code: 'ERR_RATE_LIMIT', message: 'Too many requests. Please try again later.' });
    }
    return next();
  },
  __setCandidateRecommendationRateLimitBlocked: (blocked: boolean) => {
    blockRecommendationRequests = blocked;
  },
}));

import candidatesRouter from '../candidates.routes';

const app = express();
app.use(express.json());
app.use('/api/candidates', candidatesRouter);

const uploadModule = jest.requireMock('../../middlewares/cvUpload') as {
  __setUploadBehavior: (behavior: UploadBehavior) => void;
};

const recommendationModule = jest.requireMock('../../services/recommendation.service') as {
  buildCandidateRecommendations: jest.Mock;
};

const candidateServiceModule = jest.requireMock('../../services/candidate.service') as {
  updateCandidateLocationPreference: jest.Mock;
};

const rateLimitModule = jest.requireMock('../../middlewares/rateLimit') as {
  __setCandidateRecommendationRateLimitBlocked: (blocked: boolean) => void;
};

const enqueueCvProcessingJob = jest.fn();

jest.mock('../../services/cv/cvProcessingDispatcher', () => ({
  enqueueCvProcessingJob: jest.fn((payload) => enqueueCvProcessingJob(payload)),
}));

const buildRecommendationJob = () => ({
  id: 'job-1',
  employerId: 'emp-1',
  title: 'Backend Developer',
  slug: 'backend-developer',
  description: 'Job description',
  skills: ['node'],
  salary: 1500,
  currency: 'VND',
  location: 'Hanoi',
  addressLine: '123 Street',
  provinceCode: 'VN-HN',
  provinceNameSnapshot: 'Ha Noi',
  districtCode: 'VN-HN-BA-DINH',
  districtNameSnapshot: 'Ba Dinh',
  jobType: 'FULL_TIME',
  publishedAt: new Date('2025-11-10T00:00:00Z'),
  createdAt: new Date('2025-11-09T00:00:00Z'),
  updatedAt: new Date('2025-11-11T00:00:00Z'),
  images: [
    {
      id: 'img-2',
      filePath: '/files/2.png',
      slot: 2,
      createdAt: new Date('2025-11-09T01:00:00Z'),
    },
    {
      id: 'img-1',
      filePath: '/files/1.png',
      slot: 1,
      createdAt: new Date('2025-11-09T00:30:00Z'),
    },
  ],
});
const authModule = jest.requireMock('../../middlewares/authAccess') as {
  __setMockUser: (user: typeof currentUser) => void;
};

async function clearStorageDir(): Promise<void> {
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

const tempUploads: string[] = [];

async function createUploadFile(content = 'dummy pdf'): Promise<Express.Multer.File> {
  const tempPath = path.join(os.tmpdir(), `upload-${randomUUID()}.pdf`);
  await fs.writeFile(tempPath, content);
  tempUploads.push(tempPath);
  return {
    path: tempPath,
    mimetype: 'application/pdf',
    originalname: 'resume.pdf',
    size: Buffer.byteLength(content),
  } as Express.Multer.File;
}

describe('Candidate CV upload integration tests', () => {
  beforeAll(async () => {
    await clearStorageDir();
  });

  afterEach(async () => {
    await clearStorageDir();
    prismMock.candidateCv.create.mockReset();
    prismMock.candidateCv.findMany.mockReset();
    prismMock.candidateCv.deleteMany.mockReset();
    prismMock.candidateCv.update.mockReset();
    uploadModule.__setUploadBehavior({ fileFactory: null, respondWith: null, rateLimited: false });
    virusModule.result = { isInfected: false, viruses: undefined };
    authModule.__setMockUser({ id: 'cand-1', role: 'CANDIDATE' });
    enqueueCvProcessingJob.mockReset();

    await Promise.all(
      tempUploads.splice(0).map((file) =>
        fs.rm(file, { force: true }).catch(() => undefined),
      ),
    );
  });

  afterAll(async () => {
    await clearStorageDir();
  });

  it('uploads valid CV and enqueues processing job', async () => {
    const file = await createUploadFile('PDF data');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });

    const createdAt = new Date('2025-11-13T10:00:00Z');
    prismMock.candidateCv.create.mockResolvedValue({
      id: 'cv-created',
      candidateId: 'cand-1',
      status: 'PARSING',
      uploadedAt: createdAt,
    });

    const response = await request(app).post('/api/candidates/cand-1/cv').expect(202);

    expect(prismMock.candidateCv.create).toHaveBeenCalledTimes(1);
    const payload = prismMock.candidateCv.create.mock.calls[0][0].data;
    expect(payload.candidateId).toBe('cand-1');
    expect(payload.status).toBe('PARSING');

    const storedPath = path.join(STORAGE_DIR, payload.filePath);
    await expect(fs.stat(storedPath)).resolves.toBeDefined();
    await expect(fs.access(file.path)).rejects.toThrow();

    expect(enqueueCvProcessingJob).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand-1',
        cvId: 'cv-created',
        filePath: payload.filePath,
      }),
    );
    expect(prismMock.candidateCv.update).not.toHaveBeenCalled();
    expect(response.body.data.status).toBe('PARSING');
    expect(response.body.data.processedAt).toBeUndefined();
  });

  it('rejects invalid MIME uploads with 400', async () => {
    uploadModule.__setUploadBehavior({
      respondWith: {
        status: 400,
        body: { code: 'ERR_INVALID_FILE', message: 'Only PDF uploads are allowed' },
      },
    });

    await request(app).post('/api/candidates/cand-1/cv').expect(400);

    expect(prismMock.candidateCv.create).not.toHaveBeenCalled();
    expect(prismMock.candidateCv.update).not.toHaveBeenCalled();
    expect(enqueueCvProcessingJob).not.toHaveBeenCalled();
  });

  it('rejects oversized file with 413', async () => {
    uploadModule.__setUploadBehavior({
      respondWith: {
        status: 413,
        body: { code: 'ERR_FILE_TOO_LARGE', message: 'File exceeds limit' },
      },
    });

    await request(app).post('/api/candidates/cand-1/cv').expect(413);
    expect(prismMock.candidateCv.create).not.toHaveBeenCalled();
  });

  it('rejects CV when virus detected and deletes temp file', async () => {
    const file = await createUploadFile('infected');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });

    virusModule.result = {
      isInfected: true,
      viruses: ['EICAR'],
    };

    await request(app).post('/api/candidates/cand-1/cv').expect(400);

    expect(prismMock.candidateCv.create).not.toHaveBeenCalled();
    expect(prismMock.candidateCv.update).not.toHaveBeenCalled();
    expect(enqueueCvProcessingJob).not.toHaveBeenCalled();
    await expect(fs.access(file.path)).rejects.toThrow();
  });

  it('deletes oldest CV when uploading 6th file', async () => {
    const candidateDir = path.join(STORAGE_DIR, 'cand-1');
    await fs.mkdir(candidateDir, { recursive: true });
    for (let i = 0; i < 5; i += 1) {
      const filePath = path.join(candidateDir, `existing-${i}.pdf`);
      await fs.writeFile(filePath, `file-${i}`);
      await fs.utimes(filePath, new Date(Date.now() - (10 - i) * 1000), new Date());
    }

    const file = await createUploadFile('latest');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });
    prismMock.candidateCv.create.mockResolvedValue({
      id: 'cv-latest',
      candidateId: 'cand-1',
      status: 'PARSING',
      uploadedAt: new Date(),
    });

    await request(app).post('/api/candidates/cand-1/cv').expect(202);

    const files = await fs.readdir(candidateDir);
    expect(files).toHaveLength(5);
    expect(files).not.toContain('existing-0.pdf');
  });

  it('returns 403 when uploading CV for another candidate', async () => {
    const file = await createUploadFile('forbidden');
    uploadModule.__setUploadBehavior({
      fileFactory: () => ({ ...file }),
    });
    authModule.__setMockUser({ id: 'cand-2', role: 'CANDIDATE' });

    await request(app).post('/api/candidates/cand-1/cv').expect(403);

    expect(prismMock.candidateCv.create).not.toHaveBeenCalled();
    expect(prismMock.candidateCv.update).not.toHaveBeenCalled();
    expect(enqueueCvProcessingJob).not.toHaveBeenCalled();
  });

  it('enforces rate limit after five uploads', async () => {
    const files = await Promise.all(
      Array.from({ length: 6 }).map((_, index) => createUploadFile(`payload-${index}`)),
    );
    let currentIndex = 0;
    uploadModule.__setUploadBehavior({
      fileFactory: () => {
        const next = files[currentIndex];
        currentIndex += 1;
        if (!next) {
          throw new Error('No upload file prepared');
        }
        return { ...next };
      },
      rateLimitAfter: 5,
    });

    const createdAt = new Date('2025-11-13T10:00:00Z');
    prismMock.candidateCv.create.mockResolvedValue({
      id: 'cv-created',
      candidateId: 'cand-1',
      status: 'PARSING',
      uploadedAt: createdAt,
    });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/candidates/cand-1/cv').expect(202);
    }

    await request(app).post('/api/candidates/cand-1/cv').expect(429);

    expect(prismMock.candidateCv.create).toHaveBeenCalledTimes(5);
  });
});

describe('PUT /api/candidates/me/location', () => {
  const payload = {
    provinceCode: 'VN-HN',
    districtCode: 'VN-HN-BA-DINH',
    addressLine: '123 Doi Can',
    note: 'Remote ok',
  };

  beforeEach(() => {
    candidateServiceModule.updateCandidateLocationPreference.mockReset();
    candidateServiceModule.updateCandidateLocationPreference.mockResolvedValue({
      candidateId: 'cand-1',
      preferredProvinceCode: payload.provinceCode,
      preferredAddressLine: payload.addressLine,
      preferredLocationNote: payload.note,
    });
  });

  it('persists candidate location preferences', async () => {
    const response = await request(app).put('/api/candidates/me/location').send(payload).expect(200);

    expect(candidateServiceModule.updateCandidateLocationPreference).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      provinceCode: payload.provinceCode,
      addressLine: payload.addressLine,
      note: payload.note,
    });
    expect(response.body.data).toEqual({
      candidateId: 'cand-1',
      preferredProvinceCode: payload.provinceCode,
      preferredAddressLine: payload.addressLine,
      preferredLocationNote: payload.note,
    });
  });

  it('returns 400 when payload is invalid', async () => {
    await request(app)
      .put('/api/candidates/me/location')
      .send({ addressLine: 'abc' })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('ERR_VALIDATION');
      });

    expect(candidateServiceModule.updateCandidateLocationPreference).not.toHaveBeenCalled();
  });

  it('propagates service errors', async () => {
    const { NotFoundError } = jest.requireActual('../../utils/errors');
    candidateServiceModule.updateCandidateLocationPreference.mockRejectedValueOnce(
      new NotFoundError('Candidate not found'),
    );

    await request(app).put('/api/candidates/me/location').send(payload).expect(404);
  });
});

describe('GET /api/candidates/me/recommendations', () => {
  beforeEach(() => {
    recommendationModule.buildCandidateRecommendations.mockReset();
    recommendationModule.buildCandidateRecommendations.mockResolvedValue({
      data: [],
      meta: {
        limit: 10,
        sort: 'publishedAt_desc',
        filters: { provinceCode: null },
        reason: 'missing_location',
      },
    });
    rateLimitModule.__setCandidateRecommendationRateLimitBlocked(false);
  });

  it('returns recommendations with meta payload', async () => {
    const job = buildRecommendationJob();
    const meta = {
      limit: 10,
      sort: 'publishedAt_desc' as const,
      filters: { provinceCode: 'VN-HN' },
      reason: 'province' as const,
    };
    recommendationModule.buildCandidateRecommendations.mockResolvedValue({
      data: [job],
      meta,
    });

    const response = await request(app).get('/api/candidates/me/recommendations').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: job.id,
      employerId: job.employerId,
      provinceName: job.provinceNameSnapshot,
      districtName: job.districtNameSnapshot,
      publishedAt: job.publishedAt?.toISOString(),
      images: [
        { id: 'img-1', slot: 1 },
        { id: 'img-2', slot: 2 },
      ],
    });
    expect(response.body.meta).toEqual(meta);
    expect(recommendationModule.buildCandidateRecommendations).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      limit: 10,
      sort: 'publishedAt_desc',
    });
  });

  it('accepts custom limit and sort', async () => {
    await request(app)
      .get('/api/candidates/me/recommendations?limit=5&sort=salary_desc')
      .expect(200);

    expect(recommendationModule.buildCandidateRecommendations).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      limit: 5,
      sort: 'salary_desc',
    });
  });

  it('returns 429 when rate limited', async () => {
    rateLimitModule.__setCandidateRecommendationRateLimitBlocked(true);

    await request(app).get('/api/candidates/me/recommendations').expect(429);
  });
});
