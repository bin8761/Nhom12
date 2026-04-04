import fs from 'fs';
import path from 'path';
import { ImageStorageService } from '../image-storage.service';

jest.mock('../../infra/fileSystem', () => {
  const ensureDir = jest.fn();
  const removeFile = jest.fn(() => Promise.resolve());
  const removeDirectory = jest.fn(() => Promise.resolve());

  return {
    __esModule: true,
    FileSystem: {
      ensureDir,
      removeFile,
      removeDirectory,
    },
    __mocks: {
      ensureDir,
      removeFile,
      removeDirectory,
    },
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  promises: {
    writeFile: jest.fn(() => Promise.resolve()),
    readdir: jest.fn(() => Promise.resolve([])),
    rmdir: jest.fn(() => Promise.resolve()),
  },
}));

const mockConfig = {
  storage: {
    jobImagesDir: path.join(process.cwd(), 'tmp', 'job-images'),
    maxImageSizeBytes: 1024 * 1024,
    allowedMimeTypes: ['image/png'],
  },
};

jest.mock('../../config/appConfig', () => ({
  __esModule: true,
  loadAppConfig: jest.fn(() => mockConfig),
}));

const fileSystemModule = jest.requireMock('../../infra/fileSystem') as {
  __mocks: {
    ensureDir: jest.Mock;
    removeFile: jest.Mock;
    removeDirectory: jest.Mock;
  };
};
const ensureDirMock = fileSystemModule.__mocks.ensureDir;
const removeFileMock = fileSystemModule.__mocks.removeFile;
const removeDirectoryMock = fileSystemModule.__mocks.removeDirectory;

describe('ImageStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureDirMock.mockClear();
    removeFileMock.mockClear();
    removeDirectoryMock.mockClear();
  });

  it('rejects invalid mime type', () => {
    const service = new ImageStorageService();
    expect(() => service.validateFile('image/jpeg', 100)).toThrow('Unsupported image type');
  });

  it('rejects oversize files', () => {
    const service = new ImageStorageService();
    expect(() => service.validateFile('image/png', 2 * 1024 * 1024)).toThrow('Image exceeds maximum size');
  });

  it('saves file with sanitized name and ensures directories', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    const service = new ImageStorageService();
    const relativePath = await service.save('  job-id  ', 'My File.PNG', Buffer.from('data'));

    const jobDir = path.join(mockConfig.storage.jobImagesDir, 'job-id');
    expect(ensureDirMock).toHaveBeenCalledWith(mockConfig.storage.jobImagesDir);
    expect(ensureDirMock).toHaveBeenCalledWith(jobDir);
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      path.join(jobDir, 'my-file-1234567890.png'),
      expect.any(Buffer),
    );
    expect(relativePath.endsWith(path.join('job-id', 'my-file-1234567890.png'))).toBe(true);
    dateSpy.mockRestore();
  });

  it('removes files and prunes directory on delete', async () => {
    const service = new ImageStorageService();
    await service.delete('job-id', path.join('storage', 'job-id', 'img.png'));

    expect(removeFileMock).toHaveBeenCalledWith(path.join(process.cwd(), 'storage', 'job-id', 'img.png'));
    expect(fs.promises.rmdir).toHaveBeenCalledWith(path.join(mockConfig.storage.jobImagesDir, 'job-id'));
  });

  it('recursively deletes job directory', async () => {
    const service = new ImageStorageService();
    await service.deleteJobDirectory('job-abc');
    expect(removeDirectoryMock).toHaveBeenCalledWith(path.join(mockConfig.storage.jobImagesDir, 'job-abc'));
  });
});

