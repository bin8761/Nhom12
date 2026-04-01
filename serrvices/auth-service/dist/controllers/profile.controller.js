"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyProfile = getMyProfile;
exports.updateMyProfile = updateMyProfile;
exports.getUserProfile = getUserProfile;
exports.getPublicUserProfile = getPublicUserProfile;
const profile_schema_1 = require("../schemas/profile.schema");
const errors_1 = require("../utils/errors");
const profile_service_1 = require("../services/profile.service");
const profileMetrics_1 = require("../metrics/profileMetrics");
const logger_1 = __importDefault(require("../utils/logger"));
const VALIDATION_ERROR_CODE = 'ERR_VALIDATION';
const VALIDATION_ERROR_MESSAGE = 'Invalid request payload';
function sendValidationError(res, details) {
    res.status(400).json({
        code: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details,
    });
}
function trySendServiceError(res, error) {
    if (!(0, errors_1.isServiceError)(error)) {
        return false;
    }
    res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
    });
    return true;
}
function mapProfileToResponse(result) {
    return profile_schema_1.profileResponseSchema.parse(result);
}
async function getMyProfile(req, res, next) {
    const currentUser = req.user;
    if (!currentUser?.id) {
        logger_1.default.warn({
            event: 'profile_get_failed',
            reason: 'missing_user_context',
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        (0, profileMetrics_1.recordProfileFetch)('CANDIDATE', 'forbidden');
        return;
    }
    try {
        const profile = await (0, profile_service_1.getProfileByUserId)(currentUser.id);
        const responseBody = mapProfileToResponse(profile);
        res.status(200).json({ data: responseBody });
        logger_1.default.info({
            event: 'profile_get_success',
            userId: currentUser.id,
            role: profile.role,
        });
    }
    catch (error) {
        (0, profileMetrics_1.recordProfileFetch)('CANDIDATE', 'error');
        if (trySendServiceError(res, error)) {
            logger_1.default.warn({
                event: 'profile_get_failed',
                reason: 'service_error',
                userId: currentUser.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        next(error);
    }
}
async function updateMyProfile(req, res, next) {
    const currentUser = req.user;
    const start = Date.now();
    if (!currentUser?.id || !currentUser.role) {
        logger_1.default.warn({
            event: 'profile_update_failed',
            reason: 'missing_user_context',
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        (0, profileMetrics_1.recordProfileUpdate)('CANDIDATE', 'error', 0);
        return;
    }
    const role = currentUser.role.toUpperCase();
    if (role !== 'CANDIDATE' && role !== 'EMPLOYER') {
        logger_1.default.warn({
            event: 'profile_update_failed',
            reason: 'role_not_supported',
            path: req.path,
            method: req.method,
            userId: currentUser.id,
            role: currentUser.role,
        });
        res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Profile update unsupported for this role' });
        (0, profileMetrics_1.recordProfileUpdate)(role === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE', 'error', 0);
        return;
    }
    const schema = role === 'CANDIDATE' ? profile_schema_1.candidateProfileRequestSchema : profile_schema_1.employerProfileRequestSchema;
    logger_1.default.info({
        event: 'profile_update_request',
        userId: currentUser.id,
        role,
        body: req.body,
    });
    // If body is empty, return current profile without updating
    if (!req.body || Object.keys(req.body).length === 0) {
        logger_1.default.info({
            event: 'profile_update_noop',
            userId: currentUser.id,
            role,
            reason: 'empty_body',
        });
        const profile = await (0, profile_service_1.getProfileByUserId)(currentUser.id);
        res.status(200).json({
            data: {
                profile: profile.profile,
                changedFields: [],
                updatedAt: profile.profile.updatedAt,
            },
        });
        (0, profileMetrics_1.recordProfileUpdate)(role, 'noop', (Date.now() - start) / 1000);
        return;
    }
    const parseResult = await schema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        logger_1.default.error({
            event: 'profile_update_validation_failed',
            userId: currentUser.id,
            role,
            body: req.body,
            errors: parseResult.error.issues,
            details,
        });
        sendValidationError(res, details);
        logger_1.default.warn({
            event: 'profile_update_failed',
            reason: 'validation_error',
            path: req.path,
            method: req.method,
            userId: currentUser.id,
            role,
            details,
        });
        (0, profileMetrics_1.recordProfileUpdate)(role, 'error', 0);
        return;
    }
    try {
        const result = role === 'CANDIDATE'
            ? await (0, profile_service_1.upsertCandidateProfile)({
                userId: currentUser.id,
                actorId: currentUser.id,
                payload: parseResult.data,
            })
            : await (0, profile_service_1.upsertEmployerProfile)({
                userId: currentUser.id,
                actorId: currentUser.id,
                payload: parseResult.data,
            });
        const responseSchema = role === 'CANDIDATE' ? profile_schema_1.candidateProfileResponseSchema : profile_schema_1.employerProfileResponseSchema;
        const responseBody = responseSchema.parse(result.profile);
        const status = result.changedFields.length === 0 ? 'noop' : 'success';
        (0, profileMetrics_1.recordProfileUpdate)(role, status, (Date.now() - start) / 1000);
        res.status(200).json({
            data: {
                profile: responseBody,
                changedFields: result.changedFields,
                updatedAt: result.updatedAt,
            },
        });
        logger_1.default.info({
            event: 'profile_update_success',
            userId: currentUser.id,
            role,
            changedFields: result.changedFields,
            status,
        });
    }
    catch (error) {
        (0, profileMetrics_1.recordProfileUpdate)(role, 'error', (Date.now() - start) / 1000);
        if (trySendServiceError(res, error)) {
            logger_1.default.warn({
                event: 'profile_update_failed',
                reason: 'service_error',
                path: req.path,
                method: req.method,
                userId: currentUser.id,
                role,
                error: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        next(error);
    }
}
async function getUserProfile(req, res, next) {
    try {
        const profile = await (0, profile_service_1.getProfileByUserId)(req.params.userId);
        const responseBody = mapProfileToResponse(profile);
        res.status(200).json({ data: responseBody });
        logger_1.default.info({
            event: 'profile_admin_get_success',
            adminId: req.user?.id,
            targetUserId: req.params.userId,
            role: profile.role,
        });
    }
    catch (error) {
        if (trySendServiceError(res, error)) {
            logger_1.default.warn({
                event: 'profile_admin_get_failed',
                adminId: req.user?.id,
                targetUserId: req.params.userId,
                error: error instanceof Error ? error.message : String(error),
            });
            return;
        }
        next(error);
    }
}
/**
 * Get public user profile (for chat display names)
 * Returns minimal public info: company name or full name
 */
async function getPublicUserProfile(req, res) {
    const { userId } = req.params;
    if (!userId) {
        res.status(400).json({ code: 'ERR_VALIDATION', message: 'User ID is required' });
        return;
    }
    try {
        const profile = await (0, profile_service_1.getProfileByUserId)(userId);
        // Return minimal public info based on role
        const publicData = {};
        if (profile.role === 'EMPLOYER') {
            publicData.employerProfile = {
                companyName: profile.profile.companyName || null,
                companyWebsite: profile.profile.companyWebsite || null,
                contactEmail: profile.profile.contactEmail || null,
            };
        }
        else if (profile.role === 'CANDIDATE') {
            publicData.candidateProfile = {
                fullName: profile.profile.fullName || null,
            };
        }
        res.status(200).json({ data: publicData });
    }
    catch (error) {
        if (trySendServiceError(res, error)) {
            return;
        }
        logger_1.default.error({
            event: 'public_profile_fetch_failed',
            userId,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            code: 'ERR_INTERNAL',
            message: 'Failed to fetch public profile',
        });
    }
}
//# sourceMappingURL=profile.controller.js.map