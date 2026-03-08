import {Router} from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import * as shopifyqlCampaignController from '../controllers/shopifyql-campaign-controller.js';
import * as analyticsStoreController from '../controllers/analytics-store-controller.js';
import * as storeAlertsController from '../controllers/store-alerts-controller.js';

const router = new Router();

router.get('/stats', analyticsController.getAnalytics);
router.get('/store-stats', analyticsStoreController.getStoreAnalytics);
router.get('/alerts', storeAlertsController.getAllAlerts);
router.get('/campaign-ads', shopifyqlCampaignController.getCampaignAds);
router.get('/campaign-ads/all-stores', shopifyqlCampaignController.getCampaignAdsAllStores);

export default router;
