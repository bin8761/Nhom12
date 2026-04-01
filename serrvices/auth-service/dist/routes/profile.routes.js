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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profileController = __importStar(require("../controllers/profile.controller"));
const authAccess_1 = require("../middlewares/authAccess");
const rateLimit_1 = require("../middlewares/rateLimit");
const requireRole_1 = require("../middlewares/requireRole");
const profileRouter = (0, express_1.Router)();
const profileUpdateRateLimiter = (0, rateLimit_1.createRateLimitMiddleware)({
    namespace: 'profile-update-user',
    limit: 10,
    windowSeconds: 5 * 60, // 5 minutes
    keyResolver: (req) => {
        const userId = req.user?.id;
        return userId ?? null;
    },
});
profileRouter.get('/users/me/profile', authAccess_1.authAccess, profileController.getMyProfile);
profileRouter.put('/users/me/profile', authAccess_1.authAccess, profileUpdateRateLimiter, profileController.updateMyProfile);
profileRouter.get('/admin/users/:userId/profile', authAccess_1.authAccess, (0, requireRole_1.requireRole)(['ADMIN']), profileController.getUserProfile);
// Public endpoint for chat display names
profileRouter.get('/users/:userId/public', authAccess_1.authAccess, profileController.getPublicUserProfile);
exports.default = profileRouter;
//# sourceMappingURL=profile.routes.js.map