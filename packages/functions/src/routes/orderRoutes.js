import {Router} from 'express';
import * as orderController from '../controllers/orderController.js';
import * as orderSyncController from '../controllers/orderSyncController.js';

const router = new Router();

// Order CRUD/sync
router.post('/sync', orderController.syncOrders);
router.post('/schedule', orderController.scheduleOrderSync);
router.get('/', orderController.getOrders);

// Order sync configuration
router.post('/setup-sync', orderSyncController.setupSync);
router.post('/manual-sync', orderSyncController.manualSync);
router.get('/sync-configs', orderSyncController.getSyncConfigs);
router.post('/register-webhook', orderSyncController.registerWebhook);
router.get('/webhook-instructions', orderSyncController.getWebhookInstructions);
router.get('/webhook-list', orderSyncController.getWebhookList);
router.get('/sync-stats', orderSyncController.getSyncStats);
router.post('/resync-failed', orderSyncController.resyncFailedOrders);
router.get('/queue-stats', orderSyncController.getOrderSyncQueueStats);
router.post('/process-queue', orderSyncController.processOrderSyncQueueManual);

// Webhook endpoint moved to index.js (must bypass auth middleware)

export default router;
