import { Router } from 'express';
import multer from 'multer';
import { authAccess } from '../middlewares/authAccess';
import { requireRole } from '../middlewares/requireRole';
import { requireEmployerApproval } from '../middlewares/requireEmployerApproval';
import { jobPostRateLimiter } from '../middlewares/rateLimit';
import {
  createJobHandler,
  getJobDetailHandler,
  listJobsHandler,
  deleteJobHandler,
} from '../controllers/job.controller';

const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 6, // 5 images + 1 PDF
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images' && file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    if (file.fieldname === 'document' && file.mimetype === 'application/pdf') {
      if (file.size && file.size > MAX_PDF_SIZE_BYTES) {
        cb(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname));
        return;
      }
      cb(null, true);
      return;
    }
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

const employerJobsRouter = Router();

employerJobsRouter.use(authAccess);
employerJobsRouter.use(requireRole(['EMPLOYER']));
employerJobsRouter.use(requireEmployerApproval());

employerJobsRouter.post(
  '/',
  jobPostRateLimiter,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'document', maxCount: 1 }
  ]),
  createJobHandler,
);

employerJobsRouter.get('/', listJobsHandler);
employerJobsRouter.get('/:jobId', getJobDetailHandler);
employerJobsRouter.delete('/:jobId', deleteJobHandler);

export default employerJobsRouter;
