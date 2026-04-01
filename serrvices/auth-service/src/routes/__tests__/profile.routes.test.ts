import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

let currentUser: { id: string; role: string } | null = null;

jest.mock('../../middlewares/authAccess', () => ({
  authAccess: (req: Request, res: Response, next: NextFunction) => {
    if (!currentUser) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }
    (req as any).user = currentUser;
    next();
  },
}));

jest.mock('../../middlewares/rateLimit', () => ({
  createRateLimitMiddleware: () => (req: Request, res: Response, next: NextFunction) => next(),
}));

jest.mock('../../metrics/profileMetrics', () => ({
  recordProfileFetch: jest.fn(),
  recordProfileUpdate: jest.fn(),
}));

const getProfileByUserIdMock = jest.fn();
const upsertCandidateProfileMock = jest.fn();
const upsertEmployerProfileMock = jest.fn();

jest.mock('../../services/profile.service', () => ({
  getProfileByUserId: (...args: unknown[]) => getProfileByUserIdMock(...args),
  upsertCandidateProfile: (...args: unknown[]) => upsertCandidateProfileMock(...args),
  upsertEmployerProfile: (...args: unknown[]) => upsertEmployerProfileMock(...args),
}));

import profileRouter from '../profile.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', profileRouter);
  return app;
}

describe('profile routes', () => {
  const app = buildApp();

  afterEach(() => {
    currentUser = null;
    jest.clearAllMocks();
  });

  it('returns current candidate profile', async () => {
    currentUser = { id: 'user-1', role: 'candidate' };
    getProfileByUserIdMock.mockResolvedValue({
      role: 'CANDIDATE',
      profile: {
        fullName: 'Jane Doe',
        phoneNumber: null,
        location: null,
        headline: null,
        summary: null,
        skills: [],
        yearsExperience: null,
        portfolioUrl: null,
        cvUrl: null,
        preferredJobTypes: [],
        updatedAt: null,
      },
    });

    const response = await request(app).get('/api/users/me/profile');

    expect(response.status).toBe(200);
    expect(getProfileByUserIdMock).toHaveBeenCalledWith('user-1');
    expect(response.body.data.profile.fullName).toBe('Jane Doe');
  });

  it('updates candidate profile successfully', async () => {
    currentUser = { id: 'user-1', role: 'candidate' };
    upsertCandidateProfileMock.mockResolvedValue({
      profile: {
        fullName: 'Jane Doe',
        phoneNumber: null,
        location: null,
        headline: null,
        summary: null,
        skills: ['NodeJS'],
        yearsExperience: 5,
        portfolioUrl: null,
        cvUrl: null,
        preferredJobTypes: [],
        updatedAt: new Date().toISOString(),
      },
      changedFields: ['fullName', 'skills'],
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app)
      .put('/api/users/me/profile')
      .send({ fullName: 'Jane Doe', skills: ['NodeJS'], yearsExperience: 5 });

    expect(response.status).toBe(200);
    expect(upsertCandidateProfileMock).toHaveBeenCalledWith({
      userId: 'user-1',
      actorId: 'user-1',
      payload: expect.objectContaining({ fullName: 'Jane Doe', skills: ['NodeJS'] }),
    });
    expect(response.body.data.changedFields).toEqual(expect.arrayContaining(['fullName']));
  });

  it('returns validation error for invalid payload', async () => {
    currentUser = { id: 'user-1', role: 'candidate' };

    const response = await request(app).put('/api/users/me/profile').send({ skills: ['NodeJS'] });

    expect(response.status).toBe(400);
    expect(upsertCandidateProfileMock).not.toHaveBeenCalled();
  });

  it('forbids profile update for unsupported role', async () => {
    currentUser = { id: 'admin-1', role: 'admin' };

    const response = await request(app).put('/api/users/me/profile').send({ fullName: 'Admin' });

    expect(response.status).toBe(403);
    expect(upsertCandidateProfileMock).not.toHaveBeenCalled();
  });

  it('allows admin to fetch user profile', async () => {
    currentUser = { id: 'admin-1', role: 'admin' };
    getProfileByUserIdMock.mockResolvedValue({
      role: 'EMPLOYER',
      profile: {
        companyName: 'Acme Inc',
        companyWebsite: null,
        industry: null,
        companySize: null,
        headquartersLocation: null,
        companyDescription: null,
        contactEmail: null,
        contactPhone: null,
        updatedAt: null,
      },
    });

    const response = await request(app).get('/api/admin/users/user-2/profile');

    expect(response.status).toBe(200);
    expect(getProfileByUserIdMock).toHaveBeenCalledWith('user-2');
    expect(response.body.data.profile.companyName).toBe('Acme Inc');
  });

  it('blocks unauthenticated access', async () => {
    currentUser = null;

    const response = await request(app).get('/api/users/me/profile');

    expect(response.status).toBe(401);
    expect(getProfileByUserIdMock).not.toHaveBeenCalled();
  });
});
