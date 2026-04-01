"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedisClient = initRedisClient;
exports.getRedisClient = getRedisClient;
exports.duplicateRedisConnection = duplicateRedisConnection;
exports.shutdownRedisClient = shutdownRedisClient;
const ioredis_1 = __importDefault(require("ioredis"));
const appConfig_1 = require("../../config/appConfig");
let redisClient = null;
async function initRedisClient() {
    if (redisClient) {
        return redisClient;
    }
    const { redis } = (0, appConfig_1.loadAppConfig)();
    redisClient = new ioredis_1.default(redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    redisClient.on('error', (error) => {
        if (process.env.NODE_ENV !== 'test') {
            // TODO: migrate to structured logger when available.
            console.error('[Redis] connection error', error);
        }
    });
    await redisClient.ping();
    return redisClient;
}
function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client has not been initialised. Call initRedisClient() before using it.');
    }
    return redisClient;
}
function duplicateRedisConnection(redis) {
    return redis.duplicate({
        enableReadyCheck: false,
    });
}
async function shutdownRedisClient() {
    if (!redisClient) {
        return;
    }
    await redisClient.quit();
    redisClient = null;
}
//# sourceMappingURL=redisClient.js.map