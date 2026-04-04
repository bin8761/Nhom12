import type { NextFunction, Request, Response } from 'express';
import { createJobApplication, canCandidateApply } from '../services/application.service';
import { isServiceError } from '../utils/errors';
import logger from '../utils/logger';

interface CandidateRequest extends Request {
  user?: {
    id?: string;
  };
}

/**
 * Apply to a job - POST /api/jobs/:jobId/apply
 */
export async function applyToJobHandler(
  req: CandidateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ 
        code: 'ERR_UNAUTHORIZED', 
        message: 'Access token required' 
      });
      return;
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string' || jobId.length === 0) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'jobId parameter is required',
      });
      return;
    }



    // Create application with full validation
    const result = await createJobApplication({
      jobId,
      candidateId: currentUser.id,
    });

    logger.info({
      event: 'job_application_created',
      applicationId: result.applicationId,
      jobId,
      candidateId: currentUser.id,
    });

    res.status(201).json({
      data: {
        id: result.applicationId,
        jobId,
        candidateId: currentUser.id,
        status: result.status,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    if (isServiceError(error)) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }
    next(error);
  }
}

/**
 * Check if candidate can apply to job - GET /api/jobs/:jobId/can-apply
 */
export async function checkCanApplyHandler(
  req: CandidateRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      res.status(401).json({ 
        code: 'ERR_UNAUTHORIZED', 
        message: 'Access token required' 
      });
      return;
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string' || jobId.length === 0) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'jobId parameter is required',
      });
      return;
    }

    const result = await canCandidateApply(jobId, currentUser.id);

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
