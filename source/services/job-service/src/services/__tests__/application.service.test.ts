import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { job_status, ApplicationStatus } from '@prisma/client';
import { createJobApplication, canCandidateApply } from '../application.service';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors';

// Mock Prisma client
jest.mock('../../infra/prisma/prismaClient', () => ({
  getPrismaClient: jest.fn(() => ({
    job: {
      findUnique: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
    },
    application: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    candidateCv: {
      findFirst: jest.fn(),
    },
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Application Service', () => {
  describe('createJobApplication', () => {
    it('should throw NotFoundError when job does not exist', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        createJobApplication({
          jobId: 'non-existent-job',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when job is deleted', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: job_status.APPROVED,
        deletedAt: new Date(),
        employerId: 'employer-1',
      });

      await expect(
        createJobApplication({
          jobId: 'job-1',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when job is not approved', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: job_status.PENDING,
        deletedAt: null,
        employerId: 'employer-1',
      });

      await expect(
        createJobApplication({
          jobId: 'job-1',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when candidate applies to own job', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: job_status.APPROVED,
        deletedAt: null,
        employerId: 'candidate-1', // Same as candidateId
      });

      prisma.candidate.findUnique.mockResolvedValue({
        id: 'candidate-1',
        email: 'candidate@example.com',
      });

      await expect(
        createJobApplication({
          jobId: 'job-1',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when candidate already applied', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: job_status.APPROVED,
        deletedAt: null,
        employerId: 'employer-1',
      });

      prisma.candidate.findUnique.mockResolvedValue({
        id: 'candidate-1',
        email: 'candidate@example.com',
      });

      prisma.application.findFirst.mockResolvedValue({
        id: 'existing-application',
        jobId: 'job-1',
        candidateId: 'candidate-1',
      });

      await expect(
        createJobApplication({
          jobId: 'job-1',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when candidate has no CV', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        status: job_status.APPROVED,
        deletedAt: null,
        employerId: 'employer-1',
      });

      prisma.candidate.findUnique.mockResolvedValue({
        id: 'candidate-1',
        email: 'candidate@example.com',
      });

      prisma.application.findFirst.mockResolvedValue(null);
      prisma.candidateCv.findFirst.mockResolvedValue(null);

      await expect(
        createJobApplication({
          jobId: 'job-1',
          candidateId: 'candidate-1',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should create application successfully with valid data', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      const mockJob = {
        id: 'job-1',
        status: job_status.APPROVED,
        deletedAt: null,
        employerId: 'employer-1',
        title: 'Software Engineer',
      };

      const mockCandidate = {
        id: 'candidate-1',
        email: 'candidate@example.com',
        fullName: 'John Doe',
      };

      const mockCv = {
        id: 'cv-1',
        status: 'PARSED',
        parsedFields: { name: 'John Doe', skills: ['JavaScript'] },
        filePath: '/cvs/cv-1.pdf',
      };

      const mockApplication = {
        id: 'application-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        status: ApplicationStatus.SUBMITTED,
        createdAt: new Date(),
      };

      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.candidateCv.findFirst.mockResolvedValue(mockCv);
      prisma.application.create.mockResolvedValue(mockApplication);

      const result = await createJobApplication({
        jobId: 'job-1',
        candidateId: 'candidate-1',
      });

      expect(result.applicationId).toBe('application-1');
      expect(result.status).toBe(ApplicationStatus.SUBMITTED);
      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'job-1',
            candidateId: 'candidate-1',
            status: ApplicationStatus.SUBMITTED,
          }),
        }),
      );
    });
  });

  describe('canCandidateApply', () => {
    it('should return false when job not found', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue(null);

      const result = await canCandidateApply('job-1', 'candidate-1');

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe('Job not found');
    });

    it('should return false when job is deleted', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        status: job_status.APPROVED,
        employerId: 'employer-1',
        deletedAt: new Date(),
      });

      const result = await canCandidateApply('job-1', 'candidate-1');

      expect(result.canApply).toBe(false);
      expect(result.reason).toBe('Job has been deleted');
    });

    it('should return true when all conditions are met', async () => {
      const { getPrismaClient } = await import('../../infra/prisma/prismaClient');
      const prisma = getPrismaClient() as any;
      
      prisma.job.findUnique.mockResolvedValue({
        status: job_status.APPROVED,
        employerId: 'employer-1',
        deletedAt: null,
      });

      prisma.application.findFirst.mockResolvedValue(null);
      prisma.candidateCv.findFirst.mockResolvedValue({
        id: 'cv-1',
        status: 'PARSED',
      });

      const result = await canCandidateApply('job-1', 'candidate-1');

      expect(result.canApply).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});
