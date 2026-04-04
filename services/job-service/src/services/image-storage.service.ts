import fs from 'fs';
import path from 'path';
import { loadAppConfig } from '../config/appConfig';
import { FileSystem } from '../infra/fileSystem';

export class ImageStorageService {
  private readonly rootDir: string;
  private readonly maxSizeBytes: number;
  private readonly allowedMimeTypes: Set<string>;

  constructor(rootDir = loadAppConfig().storage.jobImagesDir) {
    const config = loadAppConfig().storage;
    this.rootDir = rootDir;
    this.maxSizeBytes = config.maxImageSizeBytes;
    this.allowedMimeTypes = new Set(config.allowedMimeTypes);
    FileSystem.ensureDir(this.rootDir);
  }

  validateFile(mimeType: string | undefined, size: number): void {
    if (!mimeType || !this.allowedMimeTypes.has(mimeType)) {
      throw new Error('Unsupported image type');
    }

    if (size > this.maxSizeBytes) {
      throw new Error('Image exceeds maximum size');
    }
  }

  async save(jobId: string, filename: string, buffer: Buffer): Promise<string> {
    const normalizedJobId = jobId.trim();
    const jobDir = path.join(this.rootDir, normalizedJobId);
    FileSystem.ensureDir(jobDir);

    const safeName = this.generateSafeFilename(filename);
    const filePath = path.join(jobDir, safeName);

    await fs.promises.writeFile(filePath, buffer);

    return path.relative(process.cwd(), filePath);
  }

  async delete(jobId: string, relativePath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), relativePath);
    await FileSystem.removeFile(fullPath);
    await this.cleanupDirectoryIfEmpty(jobId);
  }

  async deleteJobDirectory(jobId: string): Promise<void> {
    const jobDir = path.join(this.rootDir, jobId);
    await FileSystem.removeDirectory(jobDir);
  }

  private async cleanupDirectoryIfEmpty(jobId: string): Promise<void> {
    const jobDir = path.join(this.rootDir, jobId);
    if (!fs.existsSync(jobDir)) {
      return;
    }

    const contents = await fs.promises.readdir(jobDir);
    if (contents.length === 0) {
      await fs.promises.rmdir(jobDir).catch(err => {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      });
    }
  }

  private generateSafeFilename(original: string): string {
    const timestamp = Date.now();
    const base = path
      .basename(original, path.extname(original))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    const extension = path.extname(original).toLowerCase() || '.jpg';
    return `${base || 'image'}-${timestamp}${extension}`;
  }
}
