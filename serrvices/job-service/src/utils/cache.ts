import { getRedisClient } from '../infra/redis/redisClient';
import logger from './logger';

/**
 * Cache utility for Redis operations
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

const DEFAULT_TTL = 300; // 5 minutes
const DEFAULT_PREFIX = 'cache';

/**
 * Get value from cache
 */
export async function getCache<T>(key: string, prefix: string = DEFAULT_PREFIX): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const fullKey = `${prefix}:${key}`;
    const cached = await redis.get(fullKey);
    
    if (!cached) {
      logger.debug({ key: fullKey }, 'Cache miss');
      return null;
    }
    
    logger.debug({ key: fullKey }, 'Cache hit');
    return JSON.parse(cached) as T;
  } catch (error) {
    logger.error({ error, key }, 'Cache get error');
    return null; // Fail gracefully
  }
}

/**
 * Set value in cache with TTL
 */
export async function setCache(
  key: string,
  value: any,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const redis = getRedisClient();
    const { ttl = DEFAULT_TTL, prefix = DEFAULT_PREFIX } = options;
    const fullKey = `${prefix}:${key}`;
    
    await redis.setex(fullKey, ttl, JSON.stringify(value));
    
    logger.debug({ key: fullKey, ttl }, 'Cache set');
  } catch (error) {
    logger.error({ error, key }, 'Cache set error');
    // Fail gracefully - don't throw
  }
}

/**
 * Delete cache key(s)
 */
export async function deleteCache(
  keys: string | string[],
  prefix: string = DEFAULT_PREFIX
): Promise<void> {
  try {
    const redis = getRedisClient();
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const fullKeys = keyArray.map(k => `${prefix}:${k}`);
    
    if (fullKeys.length > 0) {
      await redis.del(...fullKeys);
      logger.debug({ keys: fullKeys }, 'Cache deleted');
    }
  } catch (error) {
    logger.error({ error, keys }, 'Cache delete error');
    // Fail gracefully
  }
}

/**
 * Delete all keys matching pattern
 */
export async function deleteCachePattern(
  pattern: string,
  prefix: string = DEFAULT_PREFIX
): Promise<void> {
  try {
    const redis = getRedisClient();
    const fullPattern = `${prefix}:${pattern}`;
    
    // Get all keys matching pattern
    const keys = await redis.keys(fullPattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ pattern: fullPattern, count: keys.length }, 'Cache pattern deleted');
    }
  } catch (error) {
    logger.error({ error, pattern }, 'Cache pattern delete error');
    // Fail gracefully
  }
}

/**
 * Cache wrapper function - Get from cache or execute function
 */
export async function cacheWrapper<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { prefix = DEFAULT_PREFIX } = options;
  
  // Try to get from cache
  const cached = await getCache<T>(key, prefix);
  if (cached !== null) {
    return cached;
  }
  
  // Cache miss - execute function
  const result = await fn();
  
  // Save to cache
  await setCache(key, result, options);
  
  return result;
}

/**
 * Generate cache key for paginated results
 */
export function generatePaginationKey(
  base: string,
  page: number,
  limit: number,
  filters?: Record<string, any>
): string {
  const parts = [base, `page:${page}`, `limit:${limit}`];
  
  if (filters) {
    const filterStr = Object.entries(filters)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join(':');
    
    if (filterStr) {
      parts.push(filterStr);
    }
  }
  
  return parts.join(':');
}

/**
 * Cache statistics
 */
export async function getCacheStats(): Promise<{
  keys: number;
  memory: string;
  hits: number;
  misses: number;
}> {
  try {
    const redis = getRedisClient();
    const info = await redis.info('stats');
    
    // Parse Redis info
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    
    const memoryInfo = await redis.info('memory');
    const memory = memoryInfo.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'unknown';
    
    const dbSize = await redis.dbsize();
    
    return {
      keys: dbSize,
      memory,
      hits,
      misses,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats');
    return { keys: 0, memory: 'unknown', hits: 0, misses: 0 };
  }
}
