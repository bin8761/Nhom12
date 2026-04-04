import { Router } from 'express';
import { deleteMyCvHandler, getMyCvHandler, uploadCandidateCvHandler } from '../controllers/candidateCv.controller';
import { listMyApplicationsHandler, getMyApplicationDetailsHandler, withdrawMyApplicationHandler } from '../controllers/candidateApplications.controller';
import { updateMyLocationHandler } from '../controllers/candidateLocation.controller';
import { getMyRecommendationsHandler } from '../controllers/candidateRecommendation.controller';
import { authAccess } from '../middlewares/authAccess';
import { cvUploadMiddleware, cvUploadRateLimiter } from '../middlewares/cvUpload';
import { candidateRecommendationRateLimiter } from '../middlewares/rateLimit';
import { requireRole } from '../middlewares/requireRole';

const candidatesRouter = Router();

candidatesRouter.post(
  '/:candidateId/cv',
  authAccess,
  cvUploadRateLimiter,
  cvUploadMiddleware,
  uploadCandidateCvHandler,
);

candidatesRouter.get('/me/cv', authAccess, getMyCvHandler);
candidatesRouter.delete('/me/cv', authAccess, deleteMyCvHandler);
candidatesRouter.put('/me/location', authAccess, requireRole(['CANDIDATE']), updateMyLocationHandler);
candidatesRouter.get(
  '/me/recommendations',
  authAccess,
  requireRole(['CANDIDATE']),
  candidateRecommendationRateLimiter,
  getMyRecommendationsHandler,
);

candidatesRouter.get('/me/applications', authAccess, listMyApplicationsHandler);
candidatesRouter.get('/me/applications/:applicationId', authAccess, getMyApplicationDetailsHandler);
candidatesRouter.delete('/me/applications/:applicationId', authAccess, withdrawMyApplicationHandler);

export default candidatesRouter;
