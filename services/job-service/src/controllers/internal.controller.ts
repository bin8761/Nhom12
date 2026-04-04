import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { triggerSearchReindex } from '../services/search-index.service';
import logger from '../utils/logger';
import { observeJobUpdateDuration } from '../metrics/jobMetrics';

const prisma = getPrismaClient();

const syncCandidateSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(320).optional(),
  fullName: z.string().max(160).optional(),
  phoneNumber: z.string().max(32).optional(),
});

export async function syncCandidateHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = syncCandidateSchema.parse(req.body ?? {});

    const existing = await prisma.candidate.findUnique({
      where: { id: payload.id },
    });

    if (existing) {
      await prisma.candidate.update({
        where: { id: payload.id },
        data: {
          email: payload.email ?? existing.email,
          fullName: payload.fullName ?? existing.fullName,
          phoneNumber: payload.phoneNumber ?? existing.phoneNumber,
        },
      });
      res.status(200).json({ data: { id: payload.id, created: false } });
      return;
    }

    await prisma.candidate.create({
      data: {
        id: payload.id,
        email: payload.email ?? null,
        fullName: payload.fullName ?? null,
        phoneNumber: payload.phoneNumber ?? null,
      },
    });

    res.status(201).json({ data: { id: payload.id, created: true } });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        code: 'ERR_INVALID_PAYLOAD',
        message: 'Invalid candidate payload',
        details: error.issues,
      });
      return;
    }
    next(error);
  }
}

export async function reindexSearchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const start = Date.now();
  try {
    const actor = req.header('x-internal-actor') ?? 'internal';
    const result = await triggerSearchReindex({ actor });
    const durationSeconds = (Date.now() - start) / 1000;
    observeJobUpdateDuration('success', durationSeconds);
    logger.info({
      event: 'job_search_reindex_triggered',
      actor,
      durationSeconds,
      details: result.details,
    });
    res.status(202).json({ data: { status: 'queued', details: result.details } });
  } catch (error) {
    const durationSeconds = (Date.now() - start) / 1000;
    observeJobUpdateDuration('error', durationSeconds);
    logger.error({
      event: 'job_search_reindex_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
