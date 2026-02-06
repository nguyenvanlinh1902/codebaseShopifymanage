import {Router} from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = new Router();

router.get('/stats', dashboardController.getDashboardStats);

export default router;
