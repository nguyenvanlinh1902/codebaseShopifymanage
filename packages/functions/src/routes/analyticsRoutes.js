import {Router} from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import * as shopifyqlCampaignController from '../controllers/shopifyql-campaign-controller.js';
import * as analyticsStoreController from '../controllers/analytics-store-controller.js';

import * as orderAnalyticsController from '../controllers/order-analytics-controller.js';
import * as orderSearchController from '../controllers/order-search-controller.js';
import * as disputeController from '../controllers/dispute-controller.js';

const router = new Router();

router.get('/stats', analyticsController.getAnalytics);
router.get('/store-stats', analyticsStoreController.getStoreAnalytics);

router.get('/campaign-ads', shopifyqlCampaignController.getCampaignAds);
router.get('/campaign-ads/all-stores', shopifyqlCampaignController.getCampaignAdsAllStores);
router.get('/order-analytics', orderAnalyticsController.getOrderAnalytics);
router.get('/order-analytics-batch', orderAnalyticsController.getOrderAnalyticsBatch);
router.get('/order-search', orderSearchController.searchOrders);
router.get('/disputes', disputeController.getDisputes);

export default router;
