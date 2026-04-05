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
exports.getPendingEmployers = getPendingEmployers;
exports.getAllUsers = getAllUsers;
exports.approveEmployer = approveEmployer;
exports.rejectEmployer = rejectEmployer;
exports.getUserDetails = getUserDetails;
const zod_1 = require("zod");
const adminService = __importStar(require("../services/admin.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const approveSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(500).optional(),
});
const rejectSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1, 'Reason is required').max(500),
});
const getUsersQuerySchema = zod_1.z.object({
    role: zod_1.z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN']).optional(),
    status: zod_1.z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
    approvalStatus: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
async function getPendingEmployers(req, res, next) {
    try {
        const adminId = req.user?.id;
        const result = await adminService.getPendingEmployers();
        res.status(200).json({ data: result });
        logger_1.default.info({
            event: 'admin_get_pending_employers',
            adminId,
            count: result.length,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'admin_get_pending_employers_failed',
            adminId: req.user?.id,
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
}
async function getAllUsers(req, res, next) {
    try {
        const adminId = req.user?.id;
        const parseResult = getUsersQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
            res.status(400).json({
                code: 'ERR_VALIDATION',
                message: 'Invalid query parameters',
                issues: parseResult.error.flatten(),
            });
            return;
        }
        const result = await adminService.getAllUsers(parseResult.data);
        res.status(200).json(result);
        logger_1.default.info({
            event: 'admin_get_all_users',
            adminId,
            filters: parseResult.data,
            count: result.data.length,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'admin_get_all_users_failed',
            adminId: req.user?.id,
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
}
async function approveEmployer(req, res, next) {
    try {
        const adminId = req.user?.id;
        const { userId } = req.params;
        const parseResult = approveSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                code: 'ERR_VALIDATION',
                message: 'Invalid request body',
                issues: parseResult.error.flatten(),
            });
            return;
        }
        const result = await adminService.approveEmployer({
            userId,
            adminId,
            note: parseResult.data.note,
        });
        res.status(200).json({ data: result });
        logger_1.default.info({
            event: 'admin_approve_employer',
            adminId,
            userId,
            note: parseResult.data.note,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'admin_approve_employer_failed',
            adminId: req.user?.id,
            userId: req.params.userId,
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
}
async function rejectEmployer(req, res, next) {
    try {
        const adminId = req.user?.id;
        const { userId } = req.params;
        const parseResult = rejectSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                code: 'ERR_VALIDATION',
                message: 'Invalid request body',
                issues: parseResult.error.flatten(),
            });
            return;
        }
        const result = await adminService.rejectEmployer({
            userId,
            adminId,
            reason: parseResult.data.reason,
        });
        res.status(200).json({ data: result });
        logger_1.default.info({
            event: 'admin_reject_employer',
            adminId,
            userId,
            reason: parseResult.data.reason,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'admin_reject_employer_failed',
            adminId: req.user?.id,
            userId: req.params.userId,
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
}
async function getUserDetails(req, res, next) {
    try {
        const adminId = req.user?.id;
        const { userId } = req.params;
        const result = await adminService.getUserDetails(userId);
        res.status(200).json({ data: result });
        logger_1.default.info({
            event: 'admin_get_user_details',
            adminId,
            userId,
        });
    }
    catch (error) {
        logger_1.default.error({
            event: 'admin_get_user_details_failed',
            adminId: req.user?.id,
            userId: req.params.userId,
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
}
//# sourceMappingURL=admin.controller.js.map