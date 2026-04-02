import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import { authAccess } from '../middlewares/authAccess';
import { createRateLimitMiddleware } from '../middlewares/rateLimit';
import { requireRole } from '../middlewares/requireRole';

const profileRouter = Router();

const profileUpdateRateLimiter = createRateLimitMiddleware({
  namespace: 'profile-update-user',
  limit: 10,
  windowSeconds: 5 * 60, // 5 minutes
  keyResolver: (req) => {
    const userId = (req as any).user?.id;
    return userId ?? null;
  },
});

profileRouter.get('/users/me/profile', authAccess, profileController.getMyProfile);
profileRouter.put('/users/me/profile', authAccess, profileUpdateRateLimiter, profileController.updateMyProfile);

profileRouter.get(
  '/admin/users/:userId/profile',
  authAccess,
  requireRole(['ADMIN']),
  profileController.getUserProfile,
);

// Public endpoint for chat display names and job detail
profileRouter.get('/users/:userId/public', profileController.getPublicUserProfile);

export default profileRouter;
