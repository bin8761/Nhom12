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
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.resendVerification = resendVerification;
exports.verifyEmail = verifyEmail;
exports.me = me;
exports.verifyPhone = verifyPhone;
exports.resendPhoneOtp = resendPhoneOtp;
exports.changePassword = changePassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const authSchemas_1 = require("../schemas/authSchemas");
const authService = __importStar(require("../services/auth.service"));
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const VALIDATION_ERROR_CODE = 'ERR_VALIDATION';
const VALIDATION_ERROR_MESSAGE = 'Invalid request payload';
function sendValidationError(req, res, details) {
    logger_1.default.warn({
        event: 'auth_validation_failed',
        path: req.path,
        method: req.method,
        details,
    });
    res.status(400).json({
        code: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details,
    });
}
function trySendServiceError(req, res, error) {
    if (!(0, errors_1.isServiceError)(error)) {
        return false;
    }
    logger_1.default.warn({
        event: 'auth_service_error',
        path: req.path,
        method: req.method,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        message: error.message,
    });
    res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
    });
    return true;
}
async function register(req, res, next) {
    const parseResult = await authSchemas_1.registerRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const locale = req.acceptsLanguages()?.[0] ?? null;
        const tokens = await authService.register(parseResult.data, {
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
            locale,
        });
        const responseBody = authSchemas_1.authTokensResponseSchema.parse(tokens);
        res.status(201).json({ data: responseBody });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function login(req, res, next) {
    const parseResult = await authSchemas_1.loginRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        const tokens = await authService.login(parseResult.data, {
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
            requestId,
        });
        const responseBody = authSchemas_1.authTokensResponseSchema.parse(tokens);
        res.status(200).json({ data: responseBody });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function refresh(req, res, next) {
    const parseResult = await authSchemas_1.refreshRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        const tokens = await authService.refresh(parseResult.data, {
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
            requestId,
        });
        const responseBody = authSchemas_1.authTokensResponseSchema.parse(tokens);
        res.status(200).json({ data: responseBody });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function logout(req, res, next) {
    const parseResult = await authSchemas_1.logoutRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    const currentUser = req.user;
    if (!currentUser?.id) {
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        await authService.logout(parseResult.data, {
            userId: currentUser.id,
            userEmail: currentUser.email ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
            requestId,
        });
        res.status(204).send();
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function resendVerification(req, res, next) {
    const parseResult = await authSchemas_1.resendVerificationRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        const locale = req.acceptsLanguages()?.[0] ?? null;
        await authService.resendVerification(parseResult.data, {
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
            locale,
            requestId,
        });
        res.status(202).json({ data: { message: 'Verification email scheduled' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function verifyEmail(req, res, next) {
    const parseResult = await authSchemas_1.verifyEmailRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        await authService.verifyEmail(parseResult.data);
        res.status(200).json({ data: { message: 'Email verified' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function me(req, res, next) {
    const currentUser = req.user;
    if (!currentUser?.id) {
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        return;
    }
    try {
        const profile = await authService.getCurrentUserProfile(currentUser.id);
        const responseBody = authSchemas_1.meResponseSchema.parse(profile);
        res.status(200).json({ data: responseBody });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function verifyPhone(req, res, next) {
    const parseResult = await authSchemas_1.verifyPhoneRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    const currentUser = req.user;
    if (!currentUser?.id) {
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        await authService.verifyPhone(parseResult.data, { userId: currentUser.id, requestId });
        res.status(200).json({ data: { message: 'Phone verified' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function resendPhoneOtp(req, res, next) {
    const parseResult = await authSchemas_1.resendPhoneOtpRequestSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    const currentUser = req.user;
    if (!currentUser?.id) {
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        await authService.resendPhoneVerification(parseResult.data, { userId: currentUser.id, requestId });
        res.status(202).json({ data: { message: 'Phone verification code resent' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function changePassword(req, res, next) {
    const parseResult = await authSchemas_1.changePasswordSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    const currentUser = req.user;
    if (!currentUser?.id) {
        res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        await authService.changePassword({ userId: currentUser.id, requestId }, parseResult.data.currentPassword, parseResult.data.newPassword);
        res.status(200).json({ data: { message: 'Password updated' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function forgotPassword(req, res, next) {
    const parseResult = await authSchemas_1.forgotPasswordSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        const locale = req.acceptsLanguages()?.[0] ?? null;
        await authService.requestPasswordReset(parseResult.data, { requestId, locale });
        res.status(202).json({ data: { message: 'Password reset code sent if the email exists' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
async function resetPassword(req, res, next) {
    const parseResult = await authSchemas_1.resetPasswordSchema.safeParseAsync(req.body);
    if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        sendValidationError(req, res, details);
        return;
    }
    try {
        const requestId = req.get('x-request-id') ?? null;
        await authService.resetPassword(parseResult.data, { requestId });
        res.status(200).json({ data: { message: 'Password reset successful' } });
    }
    catch (error) {
        if (trySendServiceError(req, res, error)) {
            return;
        }
        next(error);
    }
}
//# sourceMappingURL=auth.controller.js.map