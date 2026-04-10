import {Router} from 'express';
import * as controller from '../controllers/tracking-status-controller.js';

const router = new Router();

// API Keys management
router.get('/keys', controller.listApiKeys);
router.post('/keys', controller.createApiKey);
router.put('/keys/:id', controller.updateApiKey);
router.post('/keys/sync-all', controller.syncAllKeysQuota);
router.post('/keys/:id/sync-quota', controller.syncKeyQuota);
router.delete('/keys/:id', controller.deleteApiKey);

// Tracking statuses
router.get('/statuses', controller.listStatuses);
router.post('/statuses/clear-invalid', controller.clearInvalidStatuses);
router.delete('/statuses/:id', controller.removeTracking);
router.post('/statuses/bulk-remove', controller.bulkRemoveTrackings);
router.post('/statuses/:id/hide', controller.hideTracking);
router.post('/statuses/:id/unhide', controller.unhideTracking);
router.get('/statuses/:trackingNumber', controller.getStatus);
router.post('/trigger', controller.triggerStatusCheck);

// Fetch orders from Shopify with tracking info (for display)
router.get('/orders', controller.fetchOrders);
// Check orders: trigger 17TRACK check via PubSub (optional storeId filter)
router.post('/check-orders', controller.checkOrders);
// Check a single tracking number
router.post('/check-single', controller.checkSingleTracking);

// Dashboard
router.get('/stats', controller.getDashboardStats);

export default router;
