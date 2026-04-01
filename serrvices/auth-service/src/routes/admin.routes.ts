import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authAccess } from '../middlewares/authAccess';
import { requireRole } from '../middlewares/requireRole';

const adminRouter = Router();

// All admin routes require authentication and ADMIN role
adminRouter.use(authAccess);
adminRouter.use(requireRole(['ADMIN']));

// Get pending employers
adminRouter.get('/users/pending', adminController.getPendingEmployers);

// Get all users with filters
adminRouter.get('/users', adminController.getAllUsers);

// Approve employer
adminRouter.post('/users/:userId/approve', adminController.approveEmployer);

// Reject employer
adminRouter.post('/users/:userId/reject', adminController.rejectEmployer);

// Get user details
adminRouter.get('/users/:userId', adminController.getUserDetails);

export default adminRouter;
