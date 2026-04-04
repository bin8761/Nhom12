import type { Request, Response, NextFunction } from 'express';
import {
  candidateLocationUpdateSchema,
  normalizeCandidateLocationPayload,
} from '../schemas/candidate.schema';
import { updateCandidateLocationPreference } from '../services/candidate.service';
import { isServiceError } from '../utils/errors';
import logger from '../utils/logger';
import { resolveRequestId } from '../utils/requestId';

const VALIDATION_ERROR = {
  code: 'ERR_VALIDATION',
  message: 'Dữ liệu không hợp lệ',
};

export async function updateMyLocationHandler(req: Request, res: Response, _next: NextFunction): Promise<void> {
  const currentUser = (req as any).user as { id?: string } | undefined;
  if (!currentUser?.id) {
    res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
    return;
  }

  const normalized = normalizeCandidateLocationPayload((req.body ?? {}) as Record<string, unknown>);
  const parsed = candidateLocationUpdateSchema.safeParse(normalized);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      ...VALIDATION_ERROR,
      details,
    });
    return;
  }

  try {
    const result = await updateCandidateLocationPreference({
      candidateId: currentUser.id,
      provinceCode: parsed.data.provinceCode,
      addressLine: parsed.data.addressLine,
      note: parsed.data.note,
    });

    const responsePayload = {
      candidateId: result.candidateId,
      preferredProvinceCode: result.preferredProvinceCode,
      preferredAddressLine: result.preferredAddressLine,
      preferredLocationNote: result.preferredLocationNote,
    };

    logger.info({
      event: 'candidate_location_updated',
      candidateId: currentUser.id,
      provinceCode: result.preferredProvinceCode,
      requestId: resolveRequestId(req),
    });

    res.status(200).json({ data: responsePayload });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }

    logger.error({
      event: 'candidate_location_update_failed',
      candidateId: currentUser.id,
      requestId: resolveRequestId(req),
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      code: 'ERR_INTERNAL',
      message: 'Unable to update candidate location',
    });
  }
}

