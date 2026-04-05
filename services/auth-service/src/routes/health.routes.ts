import { Router, Request, Response } from 'express';
import { getPrismaClient } from '../infra/prisma/prismaClient';
import { getRedisClient } from '../infra/redis/redisClient';
import { getNatsConnectionOrNull } from '../infra/nats/natsClient';

const router = Router();

// Service start time for uptime calculation
const startTime = Date.now();

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  service: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    nats: ComponentHealth;
  };
  system?: SystemMetrics;
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastCheck?: string;
  error?: string;
  details?: Record<string, unknown>;
}

interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    unit: string;
  };
  cpu: {
    user: number;
    system: number;
  };
  process: {
    pid: number;
    uptime: number;
  };
}

/**
 * Check database health
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        type: 'mysql',
        host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redis = getRedisClient();
    await redis.ping();
    const responseTime = Date.now() - start;

    // Get Redis info
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown';

    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        host: process.env.REDIS_URL || 'unknown',
        version,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check NATS health
 */
async function checkNats(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const nats = getNatsConnectionOrNull();
    
    if (!nats) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: 'NATS connection not available',
      };
    }

    // Check if connection is closed
    if (nats.isClosed()) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: 'NATS connection is closed',
      };
    }

    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: {
        servers: process.env.EVENT_BUS_URL || 'unknown',
        connected: true,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      unit: 'MB',
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
    },
    process: {
      pid: process.pid,
      uptime: Math.round(process.uptime()),
    },
  };
}

/**
 * Liveness probe - Is the service running?
 * Used by Kubernetes to restart the container if it fails
 */
router.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    service: 'auth-service',
  });
});

/**
 * Readiness probe - Is the service ready to accept traffic?
 * Used by load balancers to determine if traffic should be routed here
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const isReady = 
      dbHealth.status === 'healthy' && 
      redisHealth.status === 'healthy';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth.status,
        redis: redisHealth.status,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Detailed health check - Full health information
 * Used for monitoring, debugging, and detailed status
 */
router.get('/health/detail', async (_req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth, natsHealth] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkNats(),
    ]);

    const allHealthy = 
      dbHealth.status === 'healthy' && 
      redisHealth.status === 'healthy' && 
      natsHealth.status === 'healthy';

    const anyUnhealthy = 
      dbHealth.status === 'unhealthy' || 
      redisHealth.status === 'unhealthy' || 
      natsHealth.status === 'unhealthy';

    const overallStatus = allHealthy 
      ? 'healthy' 
      : anyUnhealthy 
        ? 'unhealthy' 
        : 'degraded';

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      service: 'auth-service',
      checks: {
        database: dbHealth,
        redis: redisHealth,
        nats: natsHealth,
      },
      system: getSystemMetrics(),
    };

    res.status(allHealthy ? 200 : 503).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Basic health check (backward compatible)
 * Kept for compatibility with existing monitoring
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth, natsHealth] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkNats(),
    ]);

    const result = {
      status: 'ok',
      checks: {
        db: dbHealth.status === 'healthy' ? 'ok' : 'fail',
        redis: redisHealth.status === 'healthy' ? 'ok' : 'fail',
        nats: natsHealth.status === 'healthy' ? 'ok' : 'fail',
      },
    };

    const anyFail = Object.values(result.checks).some((v) => v === 'fail');
    res.status(anyFail ? 503 : 200).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
