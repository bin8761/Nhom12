import { ForbiddenError } from '../../utils/errors';

const mockPrisma: any = {};
mockPrisma.user = { findUnique: jest.fn() };
mockPrisma.candidateProfile = { upsert: jest.fn() };
mockPrisma.employerProfile = { upsert: jest.fn() };
mockPrisma.$transaction = jest.fn(async (cb: (trx: any) => Promise<any>) => cb(mockPrisma));

jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: jest.fn(() => mockPrisma),
}));

const publishUserProfileUpdatedEventMock = jest.fn();
jest.mock('../../events/authEvents', () => ({
  publishUserProfileUpdatedEvent: publishUserProfileUpdatedEventMock,
}));

const recordProfileFetchMock = jest.fn();
jest.mock('../../metrics/profileMetrics', () => ({
  recordProfileFetch: recordProfileFetchMock,
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));

import { getProfileByUserId, upsertCandidateProfile, upsertEmployerProfile } from '../profile.service';

describe('profileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfileByUserId', () => {
    it('returns default candidate profile when none exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CANDIDATE',
        status: 'ACTIVE',
        emailVerified: true,
        candidateProfile: null,
        employerProfile: null,
      });

      const result = await getProfileByUserId('user-1');

      expect(result.role).toBe('CANDIDATE');
      expect(result.profile).toMatchObject({
        fullName: null,
        skills: [],
        preferredJobTypes: [],
        updatedAt: null,
      });
      expect(recordProfileFetchMock).toHaveBeenCalledWith('CANDIDATE', 'miss');
    });
  });

  describe('upsertCandidateProfile', () => {
    it('updates candidate profile and emits event', async () => {
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-1',
        fullName: 'Old Name',
        phoneNumber: null,
        location: null,
        headline: null,
        summary: null,
        skills: [],
        yearsExperience: null,
        portfolioUrl: null,
        cvUrl: null,
        preferredJobTypes: [],
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedBy: 'user-1',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CANDIDATE',
        status: 'ACTIVE',
        emailVerified: true,
        candidateProfile: existingProfile,
        employerProfile: null,
      });

      const updatedProfile = {
        ...existingProfile,
        fullName: 'New Name',
        skills: ['NodeJS'],
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      };

      mockPrisma.candidateProfile.upsert.mockResolvedValue(updatedProfile);

    const result = await upsertCandidateProfile({
      userId: 'user-1',
      actorId: 'user-1',
      payload: {
        fullName: 'New Name',
        phoneNumber: '0901234567',
      },
    });

    expect('fullName' in result.profile).toBe(true);
    if ('fullName' in result.profile) {
      expect(result.profile.fullName).toBe('New Name');
    }
    expect(result.changedFields).toEqual(expect.arrayContaining(['fullName', 'phoneNumber']));
    expect(publishUserProfileUpdatedEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        role: 'CANDIDATE',
        changedFields: expect.arrayContaining(['fullName']),
      }),
    );
  });

  it('does not publish event when no candidate fields change', async () => {
    const existingProfile = {
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Jane Doe',
      phoneNumber: null,
      location: null,
      headline: null,
      summary: null,
      skills: ['NodeJS'],
      yearsExperience: 3,
      portfolioUrl: null,
      cvUrl: null,
      preferredJobTypes: [],
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedBy: 'user-1',
    };

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      emailVerified: true,
      candidateProfile: existingProfile,
      employerProfile: null,
    });

    mockPrisma.candidateProfile.upsert.mockResolvedValue(existingProfile);

    const result = await upsertCandidateProfile({
      userId: 'user-1',
      actorId: 'user-1',
      payload: {
        fullName: 'Jane Doe',
        phoneNumber: '0901234567',
      },
    });

    expect(result.changedFields).toHaveLength(0);
    expect(publishUserProfileUpdatedEventMock).not.toHaveBeenCalled();
  });

  it('throws when candidate is not active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'CANDIDATE',
      status: 'PENDING',
        emailVerified: false,
        candidateProfile: null,
        employerProfile: null,
      });

      await expect(
        upsertCandidateProfile({
          userId: 'user-1',
          actorId: 'user-1',
          payload: {
            fullName: 'Name',
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(publishUserProfileUpdatedEventMock).not.toHaveBeenCalled();
    });
  });

  describe('upsertEmployerProfile', () => {
    it('throws when employer is not approved', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        role: 'EMPLOYER',
        status: 'ACTIVE',
        approvalStatus: 'PENDING',
        emailVerified: true,
        candidateProfile: null,
        employerProfile: null,
      });

      await expect(
        upsertEmployerProfile({
          userId: 'user-2',
          actorId: 'admin-1',
          payload: {
            companyName: 'Acme Inc',
            headquartersLocation: 'HCM',
            contactEmail: 'contact@acme.com',
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(mockPrisma.employerProfile.upsert).not.toHaveBeenCalled();
    });

    it('publishes event for employer profile changes', async () => {
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-2',
        companyName: 'Acme Inc',
        companyWebsite: null,
        industry: 'Tech',
        companySize: 'SMALL',
        headquartersLocation: 'HCM',
        companyDescription: null,
        contactEmail: null,
        contactPhone: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedBy: 'admin-1',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        role: 'EMPLOYER',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        emailVerified: true,
        candidateProfile: null,
        employerProfile: existingProfile,
      });

      const updatedProfile = {
        ...existingProfile,
        companyDescription: 'New description',
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      };

      mockPrisma.employerProfile.upsert.mockResolvedValue(updatedProfile);

      const result = await upsertEmployerProfile({
        userId: 'user-2',
        actorId: 'admin-1',
        payload: {
          companyName: 'Acme Inc',
          headquartersLocation: 'HCM',
          contactEmail: 'new@acme.com',
        },
      });

      expect(result.changedFields).toEqual(expect.arrayContaining(['contactEmail']));
      expect(publishUserProfileUpdatedEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          role: 'EMPLOYER',
          changedFields: expect.arrayContaining(['companyDescription']),
        }),
      );
    });
  });
});
