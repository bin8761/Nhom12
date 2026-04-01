import { Router } from 'express';
import { listApprovedJobsHandler, searchPublicJobsHandler, getPublicJobDetailHandler } from '../controllers/publicJobs.controller';
import { publicSearchRateLimiter } from '../middlewares/rateLimit';
import { applyToJobHandler } from '../controllers/applicationApply.controller';
import { authAccess } from '../middlewares/authAccess';
import { requireRole } from '../middlewares/requireRole';

const publicJobsRouter = Router();

publicJobsRouter.get('/', listApprovedJobsHandler);
publicJobsRouter.get('/search', publicSearchRateLimiter, searchPublicJobsHandler);
publicJobsRouter.get('/:jobId', getPublicJobDetailHandler);
publicJobsRouter.post(
  '/:jobId/apply',
  authAccess,
  requireRole(['CANDIDATE']),
  applyToJobHandler,
);

export default publicJobsRouter;
