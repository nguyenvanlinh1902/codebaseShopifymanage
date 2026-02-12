import {Router} from 'express';
import * as orderSyncController from '../../controllers/orderSyncController.js';

const router = new Router();

// Wrap POST routes to ensure storeId/userId injection from session
router.post('/setup-sync', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.store.id;
    req.body.userId = req.store.userId || req.userId || 'default-user';
  }
  return orderSyncController.setupSync(req, res);
});

router.get('/sync-configs', orderSyncController.getSyncConfigs);

export default router;
