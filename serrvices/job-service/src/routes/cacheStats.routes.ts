import { Router, Request, Response } from 'express';
import { getCacheStats } from '../utils/cache';

const router = Router();

/**
 * Get cache statistics
 * GET /cache/stats
 */
router.get('/cache/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getCacheStats();
    
    res.status(200).json({
      status: 'ok',
      cache: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
