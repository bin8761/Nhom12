"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCandidateToJobService = syncCandidateToJobService;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const appConfig_1 = require("../config/appConfig");
const logger_1 = __importDefault(require("../utils/logger"));
async function syncCandidateToJobService(user) {
    if (user.role !== client_1.UserRole.CANDIDATE) {
        return;
    }
    const config = (0, appConfig_1.loadAppConfig)();
    const baseUrl = config.jobService.baseUrl;
    const secret = config.jobService.internalSecret;
    if (!baseUrl || !secret) {
        logger_1.default.warn({
            event: 'job_service_sync_skipped',
            reason: 'missing_config',
            userId: user.id,
        });
        return;
    }
    try {
        await axios_1.default.post(`${baseUrl.replace(/\/$/, '')}/internal/candidates`, {
            id: user.id,
            email: user.email,
            fullName: user.fullName ?? undefined,
            phoneNumber: user.phoneNumber ?? undefined,
        }, {
            headers: {
                'x-internal-secret': secret,
            },
            timeout: 5000,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'job_service_candidate_sync_failed',
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
//# sourceMappingURL=jobSync.service.js.map