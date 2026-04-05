"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
const isDevelopment = process.env.NODE_ENV !== 'production';
const logger = (0, pino_1.default)({
    name: 'auth-service',
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'auth-service' },
    redact: {
        paths: [
            'password',
            'passwordHash',
            'accessToken',
            'refreshToken',
            'headers.authorization',
        ],
        remove: true,
    },
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
exports.default = logger;
//# sourceMappingURL=logger.js.map