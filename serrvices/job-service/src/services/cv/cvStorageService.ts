import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { CvStorageConfig } from '../../config/appConfig';
import {
  deleteIfExists,
  ensureDirExists,
  listFilesWithStats,
  moveFileAtomic,
} from '../../utils/fileSystem';

export interface SaveFileOptions {
  /**
   * MIME type validated upstream (default: application/pdf)
   */
  mimeType?: string;
  /**
   * Optional file name override (without directories). When omitted,
   * a timestamp + uuid based file name is generated automatically.
   */
  fileName?: string;
}

export interface StoredFileMetadata {
  relativePath: string;
  absolutePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface SignedUrl {
  token: string;
  expiresAt: Date;
  relativePath: string;
  ttlSeconds: number;
}

export interface VerifiedSignedToken {
  relativePath: string;
  expiresAt: Date;
}

export class CVStorageService {
  constructor(private readonly config: CvStorageConfig) {
    void ensureDirExists(this.config.baseDir);
  }

  /**
   * Persist a temporary file into the candidate's CV directory while
   * enforcing quota + size constraints.
   */
  async saveFile(
    candidateId: string,
    temporaryFilePath: string,
    options: SaveFileOptions = {},
  ): Promise<StoredFileMetadata> {
    const stats = await fs.stat(temporaryFilePath);
    if (stats.size > this.config.maxFileSizeBytes) {
      throw new Error(
        `CV file exceeds max allowed size of ${this.config.maxFileSizeBytes} bytes`,
      );
    }

    const targetDir = this.getCandidateDirectory(candidateId);
    await ensureDirExists(targetDir);
    await this.enforceQuota(targetDir);

    const sanitizedFileName =
      options.fileName && !options.fileName.includes(path.sep)
        ? options.fileName
        : `${Date.now()}-${randomUUID()}.pdf`;

    const destinationPath = path.join(targetDir, sanitizedFileName);
    await moveFileAtomic(temporaryFilePath, destinationPath);

    return {
      relativePath: path.relative(this.config.baseDir, destinationPath),
      absolutePath: destinationPath,
      fileName: sanitizedFileName,
      mimeType: options.mimeType ?? 'application/pdf',
      size: stats.size,
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const absolute = this.resolvePath(relativePath);
    await deleteIfExists(absolute);
  }

  getFilePath(relativePath: string): string {
    return this.resolvePath(relativePath);
  }

  generateSignedUrl(relativePath: string): SignedUrl {
    const ttlMs = this.config.signedUrlTtlSeconds * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const payload = {
      p: relativePath,
      exp: expiresAt.getTime(),
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.config.signingSecret)
      .update(encodedPayload)
      .digest('base64url');

    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt,
      relativePath,
      ttlSeconds: this.config.signedUrlTtlSeconds,
    };
  }

  private getCandidateDirectory(candidateId: string): string {
    return path.join(this.config.baseDir, candidateId);
  }

  private resolvePath(relativePath: string): string {
    const candidatePath = path.resolve(this.config.baseDir, relativePath);
    if (!candidatePath.startsWith(this.config.baseDir)) {
      throw new Error('Attempted to access path outside of CV storage root');
    }
    return candidatePath;
  }

  verifySignedToken(token: string): VerifiedSignedToken {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      throw new Error('Invalid CV download token');
    }

    const expectedSignature = createHmac('sha256', this.config.signingSecret)
      .update(encodedPayload)
      .digest('base64url');

    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (
      signatureBuf.length !== expectedBuf.length ||
      !timingSafeEqual(signatureBuf, expectedBuf)
    ) {
      throw new Error('Invalid CV download token signature');
    }

    let payload: { p?: string; exp?: number };
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );
    } catch (error) {
      throw new Error('Invalid CV download token payload');
    }

    if (!payload.p || typeof payload.p !== 'string') {
      throw new Error('Invalid CV download token path');
    }
    if (!payload.exp || typeof payload.exp !== 'number') {
      throw new Error('Invalid CV download token expiry');
    }
    if (payload.exp < Date.now()) {
      throw new Error('CV download token has expired');
    }

    return {
      relativePath: payload.p,
      expiresAt: new Date(payload.exp),
    };
  }

  private async enforceQuota(candidateDir: string): Promise<void> {
    const files = await this.safeListFiles(candidateDir);
    if (files.length < this.config.maxFilesPerCandidate) {
      return;
    }

    const filesToDelete =
      files.length - this.config.maxFilesPerCandidate + 1;
    for (let i = 0; i < filesToDelete; i += 1) {
      await deleteIfExists(files[i].absolutePath);
    }
  }

  private async safeListFiles(
    candidateDir: string,
  ): Promise<
    Array<{
      absolutePath: string;
      relativeName: string;
      createdAt: Date;
      size: number;
    }>
  > {
    try {
      return await listFilesWithStats(candidateDir);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
