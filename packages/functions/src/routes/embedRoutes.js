import {Router} from 'express';
import {verifyShopifySession} from '../middleware/verifyShopifySession.js';
import * as productImportController from '../controllers/productImportController.js';
import * as orderSyncController from '../controllers/orderSyncController.js';
import * as sheetController from '../controllers/sheetController.js';

const router = new Router();

// All embedded routes require session token verification
router.use(verifyShopifySession);

// Inject storeId from session into request for downstream controllers
router.use((req, res, next) => {
  if (req.store) {
    req.query.storeId = req.store.id;
    req.query.userId = req.store.userId || 'default-user';
    req.userId = req.store.userId || 'default-user';
    if (req.body && typeof req.body === 'object') {
      req.body.storeId = req.store.id;
      req.body.userId = req.store.userId || 'default-user';
    }
  }
  next();
});

// Get current store info
router.get('/store', (req, res) => {
  if (!req.store) {
    return res.status(404).json({success: false, error: 'Store not found'});
  }
  return res.json({
    success: true,
    data: {
      id: req.store.id,
      name: req.store.name,
      shopDomain: req.store.shopDomain,
      email: req.store.email,
      status: req.store.status
    }
  });
});

// Products - reuse existing controllers
router.post('/products/upload-csv', (req, res, next) => {
  // Embedded: auto-inject storeIds from session
  if (req.store && !req.body.storeIds) {
    req.body.storeIds = [req.store.id];
  }
  next();
}, productImportController.uploadAndImport);

router.get('/products/list', productImportController.getProducts);
router.get('/products/template', productImportController.downloadTemplate);
router.get('/products/queue-stats', productImportController.getQueueStats);
router.post('/products/process-queue', productImportController.processQueueManual);
router.get('/products/successful-imports', productImportController.getSuccessfulImports);

// Orders - reuse existing controllers
router.post('/orders/setup-sync', orderSyncController.setupSync);
router.post('/orders/manual-sync', orderSyncController.manualSync);
router.get('/orders/sync-configs', orderSyncController.getSyncConfigs);
router.get('/orders/queue-stats', orderSyncController.getOrderSyncQueueStats);

// Sheets - reuse existing controllers
router.get('/sheets', sheetController.getSheets);
router.get('/sheets/:sheetId/tabs', sheetController.getSheetTabs);
router.get('/sheets/:sheetId', sheetController.getSheet);

export default router;
