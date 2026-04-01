import { Router } from 'express';
import { verifyInternalSecret } from '../middlewares/verifyInternalSecret';
import { batchGetUsersHandler, getUserByIdHandler } from '../controllers/internal.controller';

const internalRouter = Router();

internalRouter.get('/users/:userId', verifyInternalSecret, getUserByIdHandler);
internalRouter.post('/users/batch', verifyInternalSecret, batchGetUsersHandler);

export default internalRouter;
