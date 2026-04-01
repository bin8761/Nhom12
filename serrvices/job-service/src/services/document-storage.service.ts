import path from 'node:path';
import fs from 'node:fs/promises';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const ALLOWED_MIME_TYPES = ['application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class DocumentStorageService {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.DOCUMENT_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'documents');
  }

  validateFile(mimeType: string | undefined, size: number): void {
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new ValidationError('Only PDF files are allowed');
    }

    if (size > MAX_FILE_SIZE) {
      throw new ValidationError('File size exceeds 10MB limit');
    }
  }

  async save(jobId: string, originalName: string, buffer: Buffer): Promise<string> {
    const jobDir = path.join(this.baseDir, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const filename = `job-description-${timestamp}${ext}`;
    const filePath = path.join(jobDir, filename);

    await fs.writeFile(filePath, buffer);

    const relativePath = path.join(jobId, filename);
    logger.info({
      event: 'document_saved',
      jobId,
      filename,
      size: buffer.length,
    });

    return relativePath;
  }

  async delete(jobId: string, relativePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.unlink(fullPath);
      logger.info({
        event: 'document_deleted',
        jobId,
        relativePath,
      });
    } catch (error) {
      logger.warn({
        event: 'document_delete_failed',
        jobId,
        relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteJobDirectory(jobId: string): Promise<void> {
    try {
      const jobDir = path.join(this.baseDir, jobId);
      await fs.rm(jobDir, { recursive: true, force: true });
      logger.info({
        event: 'job_document_directory_deleted',
        jobId,
      });
    } catch (error) {
      logger.warn({
        event: 'job_document_directory_delete_failed',
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getPublicUrl(relativePath: string): string {
    return `/uploads/documents/${relativePath}`;
  }
}
