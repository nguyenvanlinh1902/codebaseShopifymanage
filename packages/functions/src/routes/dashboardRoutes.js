import {Router} from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import * as dashboardFinanceController from '../controllers/dashboard-finance-controller.js';

const router = new Router();

router.get('/stats', dashboardController.getDashboardStats);
router.get('/finance-summary', dashboardFinanceController.getFinanceSummary);

export default router;
