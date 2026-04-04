import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { loadAppConfig } from '../config/appConfig';
import { createRateLimitMiddleware } from './rateLimit';
import logger from '../utils/logger';

const config = loadAppConfig();
const CV_FIELD_NAME = 'cv';
const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), 'bonenet-cv-uploads');

fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, TEMP_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      const sanitizedOriginal = file.originalname.replace(/\s+/g, '_');
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitizedOriginal}`;
      callback(null, uniqueName);
    },
  }),
  limits: {
    fileSize: config.storage.cv.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!config.storage.cv.allowedMimeTypes.includes(file.mimetype)) {
      const error = new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      error.message = 'Chỉ chấp nhận file PDF';
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const cvUploadRateLimiter = createRateLimitMiddleware({
  keyResolver: (req) => {
    const userId = typeof (req as any).user?.id === 'string' ? (req as any).user.id : null;
    return userId;
  },
  limit: 20, // Increased from 5 to 20
  windowSeconds: 60 * 60, // 1 hour
  namespace: 'cv-upload',
});

export function cvUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single(CV_FIELD_NAME)(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        logger.warn({
          event: 'cv_upload_rejected_file_too_large',
          userId: (req as any).user?.id,
          candidateId: req.params.candidateId,
          fileSizeLimit: config.storage.cv.maxFileSizeBytes,
        });
        res.status(413).json({
          code: 'ERR_FILE_TOO_LARGE',
          message: `File vượt quá giới hạn ${config.storage.cv.maxFileSizeBytes} bytes`,
        });
        return;
      }

      logger.warn({
        event: 'cv_upload_rejected_invalid_file',
        userId: (req as any).user?.id,
        candidateId: req.params.candidateId,
        reason: error.code === 'LIMIT_UNEXPECTED_FILE' ? 'mime_type' : error.code,
      });
      res.status(400).json({
        code: 'ERR_INVALID_FILE',
        message:
          error.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Chỉ chấp nhận file PDF'
            : 'Tải lên không hợp lệ',
      });
      return;
    }

    logger.error({
      event: 'cv_upload_unexpected_error',
      userId: (req as any).user?.id,
      candidateId: req.params.candidateId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  });
}
