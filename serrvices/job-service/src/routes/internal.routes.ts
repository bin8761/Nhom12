import { Router } from 'express';
import { syncCandidateHandler, reindexSearchHandler } from '../controllers/internal.controller';
import { verifyInternalSecret } from '../middlewares/internalAuth';

const internalRouter = Router();

internalRouter.post(
  '/candidates',
  verifyInternalSecret,
  syncCandidateHandler,
);

internalRouter.post(
  '/jobs/reindex-search',
  verifyInternalSecret,
  reindexSearchHandler,
);

export default internalRouter;
