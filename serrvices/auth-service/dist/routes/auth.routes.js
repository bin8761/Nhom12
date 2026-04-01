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
const authController = __importStar(require("../controllers/auth.controller"));
const authAccess_1 = require("../middlewares/authAccess");
const rateLimit_1 = require("../middlewares/rateLimit");
const authRouter = (0, express_1.Router)();
authRouter.post('/register', rateLimit_1.registerRateLimiter, authController.register);
authRouter.post('/login', rateLimit_1.loginRateLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authAccess_1.authAccess, authController.logout);
authRouter.post('/resend-verification', rateLimit_1.resendVerificationRateLimiter, authController.resendVerification);
authRouter.post('/verify-email', authController.verifyEmail);
authRouter.post('/resend-phone-otp', authAccess_1.authAccess, rateLimit_1.resendPhoneOtpRateLimiter, authController.resendPhoneOtp);
authRouter.post('/verify-phone', authAccess_1.authAccess, authController.verifyPhone);
authRouter.post('/change-password', authAccess_1.authAccess, authController.changePassword);
authRouter.post('/forgot-password', rateLimit_1.passwordResetRateLimiter, authController.forgotPassword);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.get('/me', authAccess_1.authAccess, authController.me);
exports.default = authRouter;
//# sourceMappingURL=auth.routes.js.map