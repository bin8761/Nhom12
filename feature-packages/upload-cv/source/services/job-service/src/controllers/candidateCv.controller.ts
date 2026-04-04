import type { NextFunction, Request, Response } from 'express';
import { CandidateCvStatus } from '@prisma/client';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { loadAppConfig } from '../config/appConfig';
import { CVStorageService } from '../services/cv/cvStorageService';
import { VirusScanService } from '../services/cv/virusScanService';
import { deleteIfExists } from '../utils/fileSystem';
import logger from '../utils/logger';
import { ParsedFields } from '../contracts/cv.types';
import { resolveRequestId } from '../utils/requestId';
import { observeCvUploadSize, recordCvUpload } from '../metrics/cvMetrics';
import { enqueueCvProcessingJob } from '../services/cv/cvProcessingDispatcher';
import { parseJsonObject } from '../utils/json';

const prisma = getPrismaClient();
const appConfig = loadAppConfig();
const cvStorageService = new CVStorageService(appConfig.storage.cv);
const virusScanService = new VirusScanService(appConfig.clamav);

const ERROR_UNAUTHORIZED = { code: 'ERR_UNAUTHORIZED', message: 'Access token required' };
const ERROR_FORBIDDEN = { code: 'ERR_FORBIDDEN', message: 'You are not allowed to upload for this candidate' };

export async function uploadCandidateCvHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = resolveRequestId(req);
  const currentUser = (req as any).user as { id?: string; role?: string } | undefined;
  if (!currentUser?.id) {
    res.status(401).json(ERROR_UNAUTHORIZED);
    return;
  }

  const candidateId = req.params.candidateId;
  if (typeof candidateId !== 'string' || candidateId.length === 0) {
    res.status(400).json({
      code: 'ERR_VALIDATION',
      message: 'candidateId parameter is required',
    });
    return;
  }

  const isAdmin = currentUser.role === 'ADMIN';
  if (!isAdmin && candidateId !== currentUser.id) {
    res.status(403).json(ERROR_FORBIDDEN);
    return;
  }

  const uploadedFile = req.file;
  if (!uploadedFile) {
    res.status(400).json({
      code: 'ERR_NO_FILE',
      message: 'CV file is required',
    });
    return;
  }

  let storedFilePath: string | null = null;
  let createdCvId: string | null = null;

  try {
    logger.info({
      event: 'cv_upload_received',
      candidateId,
      requestId,
      fileName: uploadedFile.originalname,
      fileSize: uploadedFile.size,
    });

    observeCvUploadSize(uploadedFile.size);

    const scanResult = await virusScanService.scan(uploadedFile.path);
    if (scanResult.isInfected) {
      await deleteIfExists(uploadedFile.path);
      res.status(400).json({
        code: 'ERR_VIRUS_DETECTED',
        message: 'Uploaded CV contains malware and has been rejected',
        details: scanResult.viruses ?? [],
        requestId,
      });
      logger.warn({
        event: 'candidate_cv_rejected_virus',
        candidateId,
        viruses: scanResult.viruses,
        requestId,
      });
      return;
    }

    const storedFile = await cvStorageService.saveFile(candidateId, uploadedFile.path, {
      mimeType: uploadedFile.mimetype,
    });
    storedFilePath = storedFile.absolutePath;

    const candidateCv = await prisma.candidateCv.create({
      data: {
        candidateId,
        filePath: storedFile.relativePath,
        fileSize: storedFile.size,
        mimeType: storedFile.mimeType,
        status: CandidateCvStatus.PARSING,
      },
    });
    createdCvId = candidateCv.id;

    await enqueueCvProcessingJob({
      cvId: candidateCv.id,
      candidateId,
      filePath: storedFile.relativePath,
      originalFileName: uploadedFile.originalname,
    });

    logger.info({
      event: 'candidate_cv_uploaded',
      candidateId,
      cvId: candidateCv.id,
      fileSize: storedFile.size,
      requestId,
    });
    recordCvUpload('success');

    res.status(202).json({
      data: {
        cvId: candidateCv.id,
        status: candidateCv.status,
        uploadedAt: candidateCv.uploadedAt.toISOString(),
      },
    });
  } catch (error) {
    if (!storedFilePath && uploadedFile?.path) {
      await deleteIfExists(uploadedFile.path);
    }
    if (storedFilePath) {
      await deleteIfExists(storedFilePath).catch(() => undefined);
    }
    if (createdCvId) {
      await prisma.candidateCv
        .update({
          where: { id: createdCvId },
          data: {
            status: CandidateCvStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'CV upload failed',
          },
        })
        .catch(() => undefined);
    }
    logger.error({
      event: 'candidate_cv_upload_failed',
      candidateId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    recordCvUpload('failed');
    next(error);
  }
}

export async function getMyCvHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUser = (req as any).user as { id?: string } | undefined;
    if (!currentUser?.id) {
      res.status(401).json(ERROR_UNAUTHORIZED);
      return;
    }

    const latestCv = await prisma.candidateCv.findFirst({
      where: { candidateId: currentUser.id },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!latestCv) {
      res.status(404).json({
        code: 'ERR_CV_NOT_FOUND',
        message: 'No CV found for the authenticated candidate',
      });
      return;
    }

    const download = cvStorageService.generateSignedUrl(latestCv.filePath);
    const downloadPath = `/cv/download?token=${download.token}`;

    const parsedFields = parseJsonObject<ParsedFields>(latestCv.parsedFields);

    res.status(200).json({
      data: {
        cvId: latestCv.id,
        status: latestCv.status,
        parsedFields: parsedFields ?? null,
        fileSize: latestCv.fileSize,
        mimeType: latestCv.mimeType,
        uploadedAt: latestCv.uploadedAt.toISOString(),
        processedAt: latestCv.processedAt?.toISOString() ?? null,
        downloadUrl: downloadPath,
        downloadUrlExpiresAt: download.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMyCvHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestId = resolveRequestId(req);
    const currentUser = (req as any).user as { id?: string } | undefined;
    if (!currentUser?.id) {
      res.status(401).json(ERROR_UNAUTHORIZED);
      return;
    }

    const records = await prisma.candidateCv.findMany({
      where: { candidateId: currentUser.id },
      select: { id: true, filePath: true },
    });

    if (records.length === 0) {
      res.status(404).json({
        code: 'ERR_CV_NOT_FOUND',
        message: 'No CV found to delete',
      });
      return;
    }

    await prisma.candidateCv.deleteMany({
      where: { candidateId: currentUser.id },
    });

    await Promise.allSettled(
      records.map((record) => cvStorageService.deleteFile(record.filePath)),
    );

    logger.info({
      event: 'candidate_cv_deleted',
      candidateId: currentUser.id,
      deletedCount: records.length,
      requestId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
