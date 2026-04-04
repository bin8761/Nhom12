import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { CVStorageService } from '../cvStorageService';

function buildService(baseDir: string, overrides: Partial<ConstructorParameters<typeof CVStorageService>[0]> = {}) {
  return new CVStorageService({
    baseDir,
    maxFilesPerCandidate: 2,
    maxFileSizeBytes: 1024,
    allowedMimeTypes: ['application/pdf'],
    signedUrlTtlSeconds: 60,
    signingSecret: 'test-secret',
    ...overrides,
  });
}

async function createTempFile(contents: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `cv-temp-${randomUUID()}.pdf`);
  await fs.writeFile(tempPath, contents);
  return tempPath;
}

describe('CVStorageService', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-storage-test-'));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('saves file and enforces quota by deleting oldest files', async () => {
    const service = buildService(baseDir, { maxFilesPerCandidate: 2 });

    const first = await createTempFile('first');
    const second = await createTempFile('second');
    const third = await createTempFile('third');

    const saved1 = await service.saveFile('cand', first);
    const saved2 = await service.saveFile('cand', second);
    await service.saveFile('cand', third);

    const candidateDir = path.join(baseDir, 'cand');
    const files = await fs.readdir(candidateDir);

    expect(files).toHaveLength(2);
    expect(files).not.toContain(path.basename(saved1.relativePath));
    expect(files).toEqual(
      expect.arrayContaining([path.basename(saved2.relativePath)]),
    );
  });

  it('throws when file exceeds max size', async () => {
    const service = buildService(baseDir, { maxFileSizeBytes: 10 });
    const bigFile = await createTempFile('a'.repeat(20));

    await expect(
      service.saveFile('cand', bigFile),
    ).rejects.toThrow(/exceeds max allowed size/);
  });

  it('deletes file via deleteFile method', async () => {
    const service = buildService(baseDir);
    const tmp = await createTempFile('deleteme');
    const saved = await service.saveFile('cand', tmp);

    await service.deleteFile(saved.relativePath);
    await expect(
      fs.stat(path.join(baseDir, saved.relativePath)),
    ).rejects.toThrow();
  });

  it('generates and verifies signed URLs', async () => {
    const service = buildService(baseDir);
    const signed = service.generateSignedUrl('cand/file.pdf');

    expect(signed.token).toBeTruthy();
    const verified = service.verifySignedToken(signed.token);

    expect(verified.relativePath).toBe('cand/file.pdf');
    expect(verified.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
