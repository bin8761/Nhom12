import NodeClam from 'clamscan';
import { ClamAVConfig } from '../../config/appConfig';
import logger from '../../utils/logger';

export interface ScanResult {
  isInfected: boolean;
  viruses?: string[];
}

export class VirusScanService {
  private clamscanInstancePromise: Promise<NodeClam> | null = null;

  constructor(private readonly config: ClamAVConfig) {}

  async scan(filePath: string): Promise<ScanResult> {
    const clamscan = await this.getOrCreateClamscan();

    try {
      const scanResult = clamscan.scanFile(filePath);
      const result = (await this.withTimeout(scanResult)) as {
        isInfected: boolean;
        viruses?: string[] | string;
      };
      const { isInfected, viruses } = result;

      return {
        isInfected,
        viruses: Array.isArray(viruses) ? viruses : undefined,
      };
    } catch (error) {
      logger.error(
        { err: error, filePath },
        'Virus scan failed due to unexpected error',
      );
      throw error;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('ClamAV scan timed out'));
      }, this.config.timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    }) as Promise<T>;
  }

  private async getOrCreateClamscan(): Promise<NodeClam> {
    if (!this.clamscanInstancePromise) {
      this.clamscanInstancePromise = new NodeClam().init({
        removeInfected: false,
        clamdscan: {
          host: this.config.host,
          port: this.config.port,
          timeout: this.config.timeoutMs,
          socket: false,
        },
      });
    }

    try {
      return await this.clamscanInstancePromise;
    } catch (error) {
      this.clamscanInstancePromise = null;
      throw error;
    }
  }
}
