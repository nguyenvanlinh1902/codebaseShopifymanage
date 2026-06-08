import {Router} from 'express';
import * as orderController from '../controllers/orderController.js';
import * as orderSyncController from '../controllers/orderSyncController.js';

const router = new Router();

// Order CRUD/sync
router.post('/sync', orderController.syncOrders);
router.post('/schedule', orderController.scheduleOrderSync);
router.get('/', orderController.getOrders);

// Order sync configuration (webhooks auto-registered on install)
router.post('/setup-sync', orderSyncController.setupSync);
router.get('/sync-configs', orderSyncController.getSyncConfigs);
router.get('/sync-stats', orderSyncController.getSyncStats);
router.post('/resync-failed', orderSyncController.resyncFailedOrders);
router.post('/sync-missing', orderSyncController.syncMissing);
router.get('/sync-missing/active', orderSyncController.getActiveSyncMissingJob);
router.post('/sync-missing/:jobId/cancel', orderSyncController.cancelSyncMissingJob);
router.get('/sync-missing/:jobId', orderSyncController.getSyncMissingJob);
router.get('/queue-stats', orderSyncController.getOrderSyncQueueStats);

// Webhook endpoint moved to index.js (must bypass auth middleware)

export default router;
