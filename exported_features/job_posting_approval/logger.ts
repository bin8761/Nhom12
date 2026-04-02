import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
  name: 'job-service',
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'job-service' },
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

export default logger;
