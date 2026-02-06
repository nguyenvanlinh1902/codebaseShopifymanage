import {Router} from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = new Router();

router.get('/stats', analyticsController.getAnalytics);

export default router;
