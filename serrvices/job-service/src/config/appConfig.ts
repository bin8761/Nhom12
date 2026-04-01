import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

type PositiveInteger = number;

export interface RedisConfig {
  url: string;
  namespaces: {
    rateLimit: string;
    queues: string;
  };
}

export interface DatabaseConfig {
  url: string;
}

export interface CvStorageConfig {
  baseDir: string;
  maxFilesPerCandidate: PositiveInteger;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  signedUrlTtlSeconds: PositiveInteger;
  signingSecret: string;
}

export interface StorageConfig {
  jobImagesDir: string;
  maxImageSizeBytes: number;
  allowedMimeTypes: string[];
  cv: CvStorageConfig;
}

export type OcrProvider = 'tesseract';

export interface OcrConfig {
  provider: OcrProvider;
  languages: string[];
  dpi: number;
}

export interface JobRateLimitConfig {
  maxSubmissions: PositiveInteger;
  windowMinutes: PositiveInteger;
}

export interface QueueConfig {
  jobApproval: {
    name: string;
    prefix: string;
  };
  cvProcessing: {
    name: string;
    prefix: string;
    dlqName: string;
  };
}

export interface MailConfig {
  sender: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: string;
  };
}

export interface EventBusConfig {
  url?: string;
}

export interface ClamAVConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

export interface InternalApiConfig {
  secret: string;
}

export interface JwtConfig {
  algorithm: 'RS256';
  issuer: string;
  audience: string;
  publicKey?: string;
}

export interface SearchCacheConfig {
  ttlSeconds: number;
  locationSeedVersion: string | null;
}

export interface RecommendationCacheConfig {
  ttlSeconds: number;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  requestTimeoutMs: PositiveInteger;
}

export interface AppConfig {
  environment: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  storage: StorageConfig;
  ocr: OcrConfig;
  queues: QueueConfig;
  jobRateLimit: JobRateLimitConfig;
  mail: MailConfig;
  eventBus: EventBusConfig;
  jwt: JwtConfig;
  clamav: ClamAVConfig;
  internalApi: InternalApiConfig;
  searchCache: SearchCacheConfig;
  recommendationCache: RecommendationCacheConfig;
  gemini: GeminiConfig;
}

const DEFAULTS = Object.freeze({
  redisUrl: 'redis://127.0.0.1:6379',
  redisRateLimitNamespace: 'job-post-rate',
  redisQueueNamespace: 'job-post-queue',
  databaseUrl: 'mysql://root:@localhost:3306/find_job',
  jobImagesDir: 'storage/job-images',
  jobImageMaxSizeBytes: 25 * 1024 * 1024,
  jobImageAllowedMimeTypes: 'image/jpeg,image/png,image/webp',
  cvStorageDir: 'storage/cv-library',
  cvMaxFilesPerCandidate: 5,
  cvMaxFileSizeBytes: 10 * 1024 * 1024,
  cvAllowedMimeTypes: 'application/pdf',
  cvSignedUrlTtlSeconds: 300,
  cvSigningSecret: 'cv-storage-dev-secret',
  jobRateLimitMax: 5,
  jobRateLimitWindowMinutes: 10,
  jobApprovalQueueName: 'jobApprovalQueue',
  cvProcessingQueueName: 'cvProcessingQueue',
  cvProcessingDlqName: 'cvProcessingQueue.dlq',
  bullmqPrefix: 'job-service',
  mailSender: 'no-reply@bonenet.local',
  smtpHost: '127.0.0.1',
  smtpPort: 1025,
  smtpSecure: false,
  eventBusUrl: 'nats://127.0.0.1:4222',
  jwtIssuer: 'job-service',
  jwtAudience: 'clients',
  clamavHost: '127.0.0.1',
  clamavPort: 3310,
  clamavTimeoutMs: 10_000,
  ocrProvider: 'tesseract',
  tesseractLang: 'eng',
  ocrDpi: 220,
  internalApiSecret: 'dev-internal-secret',
  searchCacheTtlSeconds: 60,
  recommendationCacheTtlSeconds: 30,
  geminiApiKey: 'test-gemini-key',
  geminiModel: 'gemini-1.5-flash',
  geminiRequestTimeoutMs: 60_000,
});

let cachedConfig: AppConfig | null = null;

function readNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive number, received "${raw}"`);
  }

  return parsed;
}

function readStringEnv(key: string, fallback: string): string {
  const raw = process.env[key];

  if (!raw) {
    return fallback;
  }

  return raw;
}

export function loadAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const computedConfig: AppConfig = {
    environment: process.env.NODE_ENV ?? 'development',
    database: {
      url: readStringEnv('DATABASE_URL', DEFAULTS.databaseUrl),
    },
    redis: {
      url: readStringEnv('REDIS_URL', DEFAULTS.redisUrl),
      namespaces: {
        rateLimit: readStringEnv(
          'REDIS_RATE_LIMIT_NAMESPACE',
          DEFAULTS.redisRateLimitNamespace,
        ),
        queues: readStringEnv(
          'REDIS_QUEUE_NAMESPACE',
          DEFAULTS.redisQueueNamespace,
        ),
      },
    },
    storage: {
      jobImagesDir: path.resolve(
        process.cwd(),
        process.env.JOB_IMAGES_DIR ?? DEFAULTS.jobImagesDir,
      ),
      maxImageSizeBytes: readNumberEnv(
        'JOB_IMAGE_MAX_SIZE_BYTES',
        DEFAULTS.jobImageMaxSizeBytes,
      ),
      allowedMimeTypes: readStringEnv(
        'JOB_IMAGE_ALLOWED_MIME_TYPES',
        DEFAULTS.jobImageAllowedMimeTypes,
      )
        .split(',')
        .map((type) => type.trim())
        .filter((type) => type.length > 0),
      cv: {
        baseDir: path.resolve(
          process.cwd(),
          process.env.CV_STORAGE_DIR ?? DEFAULTS.cvStorageDir,
        ),
        maxFilesPerCandidate: readNumberEnv(
          'CV_MAX_FILES_PER_CANDIDATE',
          DEFAULTS.cvMaxFilesPerCandidate,
        ),
        maxFileSizeBytes: readNumberEnv(
          'CV_MAX_FILE_SIZE_BYTES',
          DEFAULTS.cvMaxFileSizeBytes,
        ),
        allowedMimeTypes: readStringEnv(
          'CV_ALLOWED_MIME_TYPES',
          DEFAULTS.cvAllowedMimeTypes,
        )
          .split(',')
          .map((type) => type.trim())
          .filter((type) => type.length > 0),
        signedUrlTtlSeconds: readNumberEnv(
          'CV_SIGNED_URL_TTL_SECONDS',
          DEFAULTS.cvSignedUrlTtlSeconds,
        ),
        signingSecret: readStringEnv(
          'CV_SIGNING_SECRET',
          DEFAULTS.cvSigningSecret,
        ),
      },
    },
    ocr: {
      provider: readStringEnv(
        'OCR_PROVIDER',
        DEFAULTS.ocrProvider,
      ) as OcrProvider,
      languages: readStringEnv(
        'TESSERACT_LANG',
        DEFAULTS.tesseractLang,
      )
        .split(/[,+]/)
        .map((lang) => lang.trim())
        .filter((lang) => lang.length > 0),
      dpi: readNumberEnv('OCR_DPI', DEFAULTS.ocrDpi),
    },
    queues: {
      jobApproval: {
        name: readStringEnv(
          'JOB_APPROVAL_QUEUE',
          DEFAULTS.jobApprovalQueueName,
        ),
        prefix: readStringEnv('BULLMQ_PREFIX', DEFAULTS.bullmqPrefix),
      },
      cvProcessing: {
        name: readStringEnv(
          'CV_PROCESSING_QUEUE',
          DEFAULTS.cvProcessingQueueName,
        ),
        prefix: readStringEnv('BULLMQ_PREFIX', DEFAULTS.bullmqPrefix),
        dlqName: readStringEnv('CV_DLQ', DEFAULTS.cvProcessingDlqName),
      },
    },
    jobRateLimit: {
      maxSubmissions: readNumberEnv(
        'JOB_RATE_LIMIT_MAX',
        DEFAULTS.jobRateLimitMax,
      ),
      windowMinutes: readNumberEnv(
        'JOB_RATE_LIMIT_WINDOW_MINUTES',
        DEFAULTS.jobRateLimitWindowMinutes,
      ),
    },
    mail: {
      sender: readStringEnv('MAIL_SENDER', DEFAULTS.mailSender),
      smtp: {
        host: readStringEnv('MAIL_SMTP_HOST', DEFAULTS.smtpHost),
        port: readNumberEnv('MAIL_SMTP_PORT', DEFAULTS.smtpPort),
        secure: readStringEnv(
          'MAIL_SMTP_SECURE',
          String(DEFAULTS.smtpSecure),
        ).toLowerCase() === 'true',
        username: readStringEnv('MAIL_SMTP_USERNAME', ''),
        password: readStringEnv('MAIL_SMTP_PASSWORD', ''),
      },
    },
    eventBus: {
      url: readOptionalEnv('EVENT_BUS_URL'),
    },
    jwt: {
      algorithm: 'RS256',
      issuer: readStringEnv('JWT_ISSUER', DEFAULTS.jwtIssuer),
      audience: readStringEnv('JWT_AUDIENCE', DEFAULTS.jwtAudience),
      publicKey: process.env.JWT_PUBLIC_KEY?.trim() || undefined,
    },
    clamav: {
      host: readStringEnv('CLAMAV_HOST', DEFAULTS.clamavHost),
      port: readNumberEnv('CLAMAV_PORT', DEFAULTS.clamavPort),
      timeoutMs: readNumberEnv(
        'CLAMAV_TIMEOUT_MS',
        DEFAULTS.clamavTimeoutMs,
      ),
    },
    internalApi: {
      secret: readStringEnv(
        'INTERNAL_API_SECRET',
        DEFAULTS.internalApiSecret,
      ),
    },
    searchCache: {
      ttlSeconds: readNumberEnv(
        'JOB_SEARCH_CACHE_TTL_SECONDS',
        300,
      ),
      locationSeedVersion: readOptionalEnv('LOCATION_SEED_VERSION') ?? null,
    },
    recommendationCache: {
      ttlSeconds: readNumberEnv(
        'RECOMMENDATION_CACHE_TTL_SECONDS',
        DEFAULTS.recommendationCacheTtlSeconds,
      ),
    },
    gemini: {
      apiKey: readStringEnv('GEMINI_API_KEY', DEFAULTS.geminiApiKey),
      model: readStringEnv('GEMINI_MODEL', DEFAULTS.geminiModel),
      requestTimeoutMs: readNumberEnv(
        'GEMINI_REQUEST_TIMEOUT_MS',
        DEFAULTS.geminiRequestTimeoutMs,
      ),
    },
  };

  cachedConfig = Object.freeze(computedConfig);

  return cachedConfig;
}

export function resetAppConfigCache() {
  cachedConfig = null;
}


function readOptionalEnv(key: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
