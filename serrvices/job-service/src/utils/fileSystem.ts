import { promises as fs } from 'fs';
import path from 'path';

export async function ensureDirExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function moveFileAtomic(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await ensureDirExists(path.dirname(destinationPath));
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error: any) {
    if (error?.code === 'EXDEV') {
      await fs.copyFile(sourcePath, destinationPath);
      await fs.unlink(sourcePath);
      return;
    }
    throw error;
  }
}

export async function deleteIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

export async function listFilesWithStats(dirPath: string): Promise<
  Array<{
    absolutePath: string;
    relativeName: string;
    createdAt: Date;
    size: number;
  }>
> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: Array<{
    absolutePath: string;
    relativeName: string;
    createdAt: Date;
    size: number;
  }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    const stats = await fs.stat(absolutePath);
    results.push({
      absolutePath,
      relativeName: entry.name,
      createdAt: stats.birthtime ?? stats.ctime,
      size: stats.size,
    });
  }

  return results.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
