import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authAccess } from '../middlewares/authAccess';
import {
  loginRateLimiter,
  registerRateLimiter,
  resendVerificationRateLimiter,
  resendPhoneOtpRateLimiter,
  passwordResetRateLimiter,
} from '../middlewares/rateLimit';

const authRouter = Router();

authRouter.post('/register', registerRateLimiter, authController.register);
authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authAccess, authController.logout);
authRouter.post('/resend-verification', resendVerificationRateLimiter, authController.resendVerification);
authRouter.post('/verify-email', authController.verifyEmail);
authRouter.post(
  '/resend-phone-otp',
  authAccess,
  resendPhoneOtpRateLimiter,
  authController.resendPhoneOtp,
);
authRouter.post('/verify-phone', authAccess, authController.verifyPhone);
authRouter.post('/change-password', authAccess, authController.changePassword);
authRouter.post('/forgot-password', passwordResetRateLimiter, authController.forgotPassword);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.get('/me', authAccess, authController.me);

export default authRouter;
