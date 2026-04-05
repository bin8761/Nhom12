import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { resolveRequestId } from '../utils/requestId';

export async function downloadCvHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const context = req.cvDownloadContext;
    if (!context) {
      res.status(500).json({ code: 'ERR_INTERNAL', message: 'Download context missing' });
      return;
    }

    const requestId = resolveRequestId(req);

    logger.info({
      event: 'cv_download',
      cvId: context.cvId,
      candidateId: context.candidateId,
      actorId: context.actorId ?? 'signed-token',
      actorRole: context.actorRole ?? 'SIGNED_URL',
      employerId: context.actorRole === 'EMPLOYER' ? context.actorId : undefined,
      source: context.source,
      requestId,
    });

    res.setHeader('Content-Type', context.mimeType);
    res.setHeader('Content-Length', context.fileSize.toString());
    res.setHeader(
      'Content-Disposition',
      `inline; filename=\"${safeFilename(context.candidateId)}.pdf\"`,
    );

    res.sendFile(context.absolutePath, (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_');
}
