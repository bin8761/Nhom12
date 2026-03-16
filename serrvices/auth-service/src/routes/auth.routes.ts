import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { loginRateLimiter } from '../middlewares/rateLimit';

const authRouter = Router();

authRouter.post('/login', loginRateLimiter, authController.login);

export default authRouter;
