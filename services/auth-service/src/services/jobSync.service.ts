import axios from 'axios';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { loadAppConfig } from '../config/appConfig';
import logger from '../utils/logger';

export async function syncCandidateToJobService(user: User): Promise<void> {
  if (user.role !== UserRole.CANDIDATE) {
    return;
  }

  const config = loadAppConfig();
  const baseUrl = config.jobService.baseUrl;
  const secret = config.jobService.internalSecret;

  if (!baseUrl || !secret) {
    logger.warn({
      event: 'job_service_sync_skipped',
      reason: 'missing_config',
      userId: user.id,
    });
    return;
  }

  try {
    await axios.post(
      `${baseUrl.replace(/\/$/, '')}/internal/candidates`,
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName ?? undefined,
        phoneNumber: user.phoneNumber ?? undefined,
      },
      {
        headers: {
          'x-internal-secret': secret,
        },
        timeout: 5_000,
      },
    );
  } catch (error) {
    logger.error({
      event: 'job_service_candidate_sync_failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
