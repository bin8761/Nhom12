import { Router } from 'express';
import {
  listProvincesHandler,
  suggestLocationsHandler,
} from '../controllers/location.controller';

const publicLocationsRouter = Router();

publicLocationsRouter.get('/provinces', listProvincesHandler);
publicLocationsRouter.get('/suggestions', suggestLocationsHandler);

export default publicLocationsRouter;
