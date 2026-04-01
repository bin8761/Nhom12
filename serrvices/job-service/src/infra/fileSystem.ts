import fs from 'fs';
import path from 'path';

export class FileSystem {
  static ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static async removeFile(filePath: string) {
    return fs.promises
      .unlink(filePath)
      .catch(err => {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      });
  }

  static async removeDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return FileSystem.removeDirectory(fullPath);
        }
        return FileSystem.removeFile(fullPath);
      }),
    );

    await fs.promises.rmdir(dirPath).catch(err => {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    });
  }
}
