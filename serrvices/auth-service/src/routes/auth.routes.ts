import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import {
  loginRateLimiter,
  registerRateLimiter,
} from '../middlewares/rateLimit';

const authRouter = Router();

authRouter.post('/register', registerRateLimiter, authController.register);
authRouter.post('/login', loginRateLimiter, authController.login);

export default authRouter;
