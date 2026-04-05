import Redis, { RedisOptions } from 'ioredis';
export interface RedisConnectionOptions extends RedisOptions {
}
export declare function initRedisClient(): Promise<Redis>;
export declare function getRedisClient(): Redis;
export declare function duplicateRedisConnection(redis: Redis): Redis;
export declare function shutdownRedisClient(): Promise<void>;
//# sourceMappingURL=redisClient.d.ts.map