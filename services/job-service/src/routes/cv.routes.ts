import { Router } from 'express';
import { cvDownloadAuthorization } from '../middlewares/cvDownloadAuth';
import { downloadCvHandler } from '../controllers/cvDownload.controller';

const cvRouter = Router();

cvRouter.get('/download', cvDownloadAuthorization, downloadCvHandler);

export default cvRouter;
