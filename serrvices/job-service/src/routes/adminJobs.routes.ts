import { Router } from 'express';
import { authAccess } from '../middlewares/authAccess';
import { requireRole } from '../middlewares/requireRole';
import { listPendingJobs, approveJobHandler, rejectJobHandler, deleteJobHandler } from '../controllers/adminJobs.controller';

const adminJobsRouter = Router();

adminJobsRouter.use(authAccess);
adminJobsRouter.use(requireRole(['ADMIN']));

adminJobsRouter.get('/', listPendingJobs);
adminJobsRouter.post('/:jobId/approve', approveJobHandler);
adminJobsRouter.post('/:jobId/reject', rejectJobHandler);
adminJobsRouter.delete('/:jobId', deleteJobHandler);

export default adminJobsRouter;
