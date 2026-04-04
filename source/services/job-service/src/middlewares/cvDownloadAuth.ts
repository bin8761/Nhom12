import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loadAppConfig } from '../config/appConfig';
import { resolvePublicKey } from '../utils/tokenGenerator';
import { CVStorageService } from '../services/cv/cvStorageService';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import logger from '../utils/logger';
import { CandidateCvStatus } from '@prisma/client';

const prisma = getPrismaClient();
const config = loadAppConfig();
const cvStorageService = new CVStorageService(config.storage.cv);

interface CvDownloadContext {
  cvId: string;
  candidateId: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  fileSize: number;
  source: 'signed-token' | 'candidate' | 'employer';
  actorId?: string;
  actorRole?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    cvDownloadContext?: CvDownloadContext;
    user?: {
      id?: string;
      role?: string;
    };
  }
}

export async function cvDownloadAuthorization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokenParam = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (tokenParam) {
      await authorizeViaSignedToken(tokenParam, req);
      next();
      return;
    }

    const user = decodeJwtUser(req);
    if (!user) {
      res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
      return;
    }

    if (user.role === 'CANDIDATE') {
      await authorizeCandidateDownload(user.id, req);
      next();
      return;
    }

    if (user.role === 'EMPLOYER') {
      const applicationId =
        typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
      if (!applicationId) {
        res.status(400).json({
          code: 'ERR_VALIDATION',
          message: 'applicationId query parameter is required for employers',
        });
        return;
      }

      await authorizeEmployerDownload(user.id, applicationId, req);
      next();
      return;
    }

    res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Access denied' });
  } catch (error) {
    res.status(403).json({
      code: 'ERR_FORBIDDEN',
      message: error instanceof Error ? error.message : 'Access denied',
    });
  }
}

async function authorizeViaSignedToken(token: string, req: Request): Promise<void> {
  const verified = cvStorageService.verifySignedToken(token);
  const cvRecord = await prisma.candidateCv.findFirst({
    where: { filePath: verified.relativePath },
    orderBy: { uploadedAt: 'desc' },
  });
  if (!cvRecord) {
    logger.warn({
      event: 'cv_download_not_found',
      relativePath: verified.relativePath,
    });
    throw new Error('CV not found for provided token');
  }

  req.cvDownloadContext = {
    cvId: cvRecord.id,
    candidateId: cvRecord.candidateId,
    relativePath: cvRecord.filePath,
    absolutePath: cvStorageService.getFilePath(cvRecord.filePath),
    mimeType: cvRecord.mimeType,
    fileSize: cvRecord.fileSize,
    source: 'signed-token',
  };
}

async function authorizeCandidateDownload(candidateId: string | undefined, req: Request): Promise<void> {
  if (!candidateId) {
    throw new Error('Invalid candidate identity');
  }
  const cvRecord = await prisma.candidateCv.findFirst({
    where: { candidateId },
    orderBy: { uploadedAt: 'desc' },
  });
  if (!cvRecord) {
    throw new Error('No CV found for candidate');
  }

  req.cvDownloadContext = {
    cvId: cvRecord.id,
    candidateId,
    relativePath: cvRecord.filePath,
    absolutePath: cvStorageService.getFilePath(cvRecord.filePath),
    mimeType: cvRecord.mimeType,
    fileSize: cvRecord.fileSize,
    source: 'candidate',
    actorId: candidateId,
    actorRole: 'CANDIDATE',
  };
}

async function authorizeEmployerDownload(
  employerId: string | undefined,
  applicationId: string,
  req: Request,
): Promise<void> {
  if (!employerId) {
    throw new Error('Invalid employer identity');
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      candidateId: true,
      job: { select: { employerId: true } },
    },
  });

  if (!application || application.job.employerId !== employerId) {
    throw new Error('Application not found or access denied');
  }

  const cvRecord = await prisma.candidateCv.findFirst({
    where: { candidateId: application.candidateId, status: CandidateCvStatus.PARSED },
    orderBy: { uploadedAt: 'desc' },
  });

  if (!cvRecord) {
    throw new Error('Candidate has no parsed CV');
  }

  req.cvDownloadContext = {
    cvId: cvRecord.id,
    candidateId: application.candidateId,
    relativePath: cvRecord.filePath,
    absolutePath: cvStorageService.getFilePath(cvRecord.filePath),
    mimeType: cvRecord.mimeType,
    fileSize: cvRecord.fileSize,
    source: 'employer',
    actorId: employerId,
    actorRole: 'EMPLOYER',
  };
}

function decodeJwtUser(
  req: Request,
): { id?: string; role?: string } | null {
  const authHeader = req.get('authorization') || req.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const publicKey = resolvePublicKey();
  if (!publicKey) {
    return null;
  }
  try {
    const payload = jwt.verify(token, publicKey, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as Record<string, unknown>;
    return { id: payload.sub as string, role: payload.role as string };
  } catch {
    return null;
  }
}
