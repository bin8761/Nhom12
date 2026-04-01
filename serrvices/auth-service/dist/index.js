"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Suppress Redis version warnings
const suppressRedisVersionWarnings = (originalMethod) => {
    return (...args) => {
        const message = args[0];
        if (typeof message === 'string' &&
            (message.includes('highly recommended to use a minimum Redis version') ||
                message.includes('Current:') ||
                message.includes('Redis version'))) {
            return; // Suppress Redis version warnings
        }
        originalMethod.apply(console, args);
    };
};
const originalWarn = console.warn;
const originalLog = console.log;
console.warn = suppressRedisVersionWarnings(originalWarn);
console.log = suppressRedisVersionWarnings(originalLog);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const envValidation_1 = require("./config/envValidation");
const appContext_1 = require("./container/appContext");
const emailVerificationWorker_1 = require("./jobs/emailVerificationWorker");
const cleanupQueue_1 = require("./jobs/cleanupQueue");
const cleanupWorker_1 = require("./jobs/cleanupWorker");
const employerApprovalWorker_1 = require("./jobs/employerApprovalWorker");
const approvalNotificationWorker_1 = require("./jobs/approvalNotificationWorker");
const phoneVerificationWorker_1 = require("./jobs/phoneVerificationWorker");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const natsClient_1 = require("./infra/nats/natsClient");
// Validate environment variables before starting
const env = (0, envValidation_1.validateEnv)();
(0, envValidation_1.printEnvSummary)(env);
const requestLogger_1 = require("./middlewares/requestLogger");
const gracefulShutdown_1 = require("./utils/gracefulShutdown");
(0, appContext_1.bootstrapAppContext)()
    .then(async (context) => {
    try {
        await (0, natsClient_1.initNatsConnection)({ servers: context.config.eventBus.url });
        console.info('[Bootstrap] Connected to NATS');
    }
    catch (error) {
        console.error('[Bootstrap] Failed to connect to NATS', error);
        throw error;
    }
    (0, emailVerificationWorker_1.initEmailVerificationWorker)(context.redis);
    (0, cleanupWorker_1.initCleanupWorker)(context.redis);
    (0, employerApprovalWorker_1.initEmployerApprovalWorker)(context.redis);
    (0, approvalNotificationWorker_1.initApprovalNotificationWorker)(context.redis);
    (0, phoneVerificationWorker_1.initPhoneVerificationWorker)(context.redis);
    (0, cleanupQueue_1.scheduleCleanupJobs)().catch((e) => {
        console.error('[Bootstrap] Failed to schedule cleanup jobs', e);
    });
    const app = (0, express_1.default)();
    // Request ID and logging middleware (before other middlewares)
    app.use(requestLogger_1.requestIdMiddleware);
    app.use(requestLogger_1.requestLoggerMiddleware);
    app.use(requestLogger_1.requestIdMiddleware);
    app.use(requestLogger_1.requestLoggerMiddleware);
    // CORS configuration
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.FRONTEND_URL,
    ].filter(Boolean);
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-Request-ID'],
        maxAge: 86400, // 24 hours
    }));
    app.use(express_1.default.json());
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api', profile_routes_1.default);
    app.use('/api/admin', admin_routes_1.default);
    app.use('/internal', (await Promise.resolve().then(() => __importStar(require('./routes/internal.routes')))).default);
    app.use('/', health_routes_1.default);
    // Shutdown middleware (reject requests during shutdown)
    app.use(gracefulShutdown_1.shutdownMiddleware);
    // Error logging middleware (after routes)
    app.use(requestLogger_1.errorLoggerMiddleware);
    const port = process.env.PORT ? Number(process.env.PORT) : 4001;
    const server = app.listen(port, () => {
        if (process.env.NODE_ENV !== 'test') {
            console.info(`[Bootstrap] Auth service listening on : ${port}`);
        }
    });
    // Setup graceful shutdown
    (0, gracefulShutdown_1.setupGracefulShutdown)(server, {
        timeout: 30000, // 30 seconds
        onShutdownStart: async () => {
            console.info('[Shutdown] Stopping workers...');
            // Workers will stop accepting new jobs
        },
        onShutdownComplete: async () => {
            console.info('[Shutdown] All resources cleaned up');
        },
    });
})
    .catch((error) => {
    console.error('[Bootstrap] Failed to initialise infrastructure', error);
    void (0, natsClient_1.closeNatsConnection)();
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map