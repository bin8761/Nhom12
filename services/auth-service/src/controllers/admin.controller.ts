import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import logger from '../utils/logger';

const approveSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

const getUsersQuerySchema = z.object({
  role: z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function getPendingEmployers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user?.id;
    const result = await adminService.getPendingEmployers();

    res.status(200).json({ data: result });

    logger.info({
      event: 'admin_get_pending_employers',
      adminId,
      count: result.length,
    });
  } catch (error) {
    logger.error({
      event: 'admin_get_pending_employers_failed',
      adminId: (req as any).user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user?.id;
    const parseResult = getUsersQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Invalid query parameters',
        issues: parseResult.error.flatten(),
      });
      return;
    }

    const result = await adminService.getAllUsers(parseResult.data);

    res.status(200).json(result);

    logger.info({
      event: 'admin_get_all_users',
      adminId,
      filters: parseResult.data,
      count: result.data.length,
    });
  } catch (error) {
    logger.error({
      event: 'admin_get_all_users_failed',
      adminId: (req as any).user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function approveEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user?.id;
    const { userId } = req.params;

    const parseResult = approveSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Invalid request body',
        issues: parseResult.error.flatten(),
      });
      return;
    }

    const result = await adminService.approveEmployer({
      userId,
      adminId,
      note: parseResult.data.note,
    });

    res.status(200).json({ data: result });

    logger.info({
      event: 'admin_approve_employer',
      adminId,
      userId,
      note: parseResult.data.note,
    });
  } catch (error) {
    logger.error({
      event: 'admin_approve_employer_failed',
      adminId: (req as any).user?.id,
      userId: req.params.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function rejectEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user?.id;
    const { userId } = req.params;

    const parseResult = rejectSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        code: 'ERR_VALIDATION',
        message: 'Invalid request body',
        issues: parseResult.error.flatten(),
      });
      return;
    }

    const result = await adminService.rejectEmployer({
      userId,
      adminId,
      reason: parseResult.data.reason,
    });

    res.status(200).json({ data: result });

    logger.info({
      event: 'admin_reject_employer',
      adminId,
      userId,
      reason: parseResult.data.reason,
    });
  } catch (error) {
    logger.error({
      event: 'admin_reject_employer_failed',
      adminId: (req as any).user?.id,
      userId: req.params.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

export async function getUserDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as any).user?.id;
    const { userId } = req.params;

    const result = await adminService.getUserDetails(userId);

    res.status(200).json({ data: result });

    logger.info({
      event: 'admin_get_user_details',
      adminId,
      userId,
    });
  } catch (error) {
    logger.error({
      event: 'admin_get_user_details_failed',
      adminId: (req as any).user?.id,
      userId: req.params.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
