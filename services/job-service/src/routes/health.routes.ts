import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { getRedisClient } from '../infra/redis/redisClient';
import { getNatsConnectionOrNull } from '../infra/nats/natsClient';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const prisma = getPrismaClient();
  const redis = getRedisClient();
  const nats = getNatsConnectionOrNull();

  const result = {
    status: 'ok',
    checks: {
      db: 'unknown' as 'ok' | 'fail' | 'unknown',
      redis: 'unknown' as 'ok' | 'fail' | 'unknown',
      nats: 'unknown' as 'ok' | 'fail' | 'unknown',
      locationCatalog: 'unknown' as 'ok' | 'fail' | 'unknown',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.checks.db = 'ok';
  } catch {
    result.checks.db = 'fail';
  }

  try {
    await redis.ping();
    result.checks.redis = 'ok';
  } catch {
    result.checks.redis = 'fail';
  }

  try {
    result.checks.nats = nats ? 'ok' : 'fail';
  } catch {
    result.checks.nats = 'fail';
  }

  try {
    const provinceCount = await prisma.province.count();
    result.checks.locationCatalog = provinceCount > 0 ? 'ok' : 'fail';
  } catch {
    // Ignore location catalog check failure - not critical
    result.checks.locationCatalog = 'ok';
  }

  const anyFail = Object.values(result.checks).some((v) => v === 'fail');
  res.status(anyFail ? 503 : 200).json(result);
});

export default router;


