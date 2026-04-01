import { Router } from 'express';
import { listApprovedJobsHandler, searchPublicJobsHandler, getPublicJobDetailHandler } from '../controllers/publicJobs.controller';
import { publicSearchRateLimiter } from '../middlewares/rateLimit';

const publicJobsRouter = Router();

publicJobsRouter.get('/', listApprovedJobsHandler);
publicJobsRouter.get('/search', publicSearchRateLimiter, searchPublicJobsHandler);
publicJobsRouter.get('/:jobId', getPublicJobDetailHandler);

export default publicJobsRouter;
