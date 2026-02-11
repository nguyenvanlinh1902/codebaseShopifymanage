import {Router} from 'express';
import {verifyShopifySession} from '../middleware/verifyShopifySession.js';
import * as productImportController from '../controllers/productImportController.js';
import * as orderSyncController from '../controllers/orderSyncController.js';
import * as sheetController from '../controllers/sheetController.js';
import * as googleAuthController from '../controllers/googleAuthController.js';

const router = new Router();

// All embedded routes require session token verification
router.use(verifyShopifySession);

// Inject storeId from session into request for downstream controllers
router.use((req, res, next) => {
  if (req.store) {
    // In embedded mode, use storeId as userId for data scoping
    const effectiveUserId = req.store.userId || req.store.id;

    req.query.storeId = req.store.id;
    req.query.userId = effectiveUserId;
    req.userId = effectiveUserId;
    if (req.body && typeof req.body === 'object') {
      req.body.storeId = req.store.id;
      req.body.userId = effectiveUserId;
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

// Get all dashboard data in one call (optimization)
router.get('/dashboard', async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    // Helper to create mock response that captures data
    const createMockRes = () => {
      let capturedData = null;
      return {
        json: data => {
          capturedData = data;
          return capturedData;
        },
        status: () => ({
          json: data => {
            capturedData = data;
            return capturedData;
          }
        }),
        data: () => capturedData
      };
    };

    // Create mock responses
    const productStatsMock = createMockRes();
    const syncConfigsMock = createMockRes();
    const sheetsMock = createMockRes();
    const googleStatusMock = createMockRes();

    // Fetch all data in parallel with proper mock objects
    await Promise.all([
      productImportController.getQueueStats({query: {storeId: req.store.id}}, productStatsMock),
      orderSyncController.getSyncConfigs({query: {storeId: req.store.id}}, syncConfigsMock),
      sheetController.getSheets({query: {storeId: req.store.id}}, sheetsMock),
      googleAuthController.checkGoogleAuth(
        {query: {storeId: req.store.id, userId: req.store.userId}},
        googleStatusMock
      )
    ]);

    // Extract captured data
    const productStatsRes = productStatsMock.data();
    const syncConfigsRes = syncConfigsMock.data();
    const sheetsRes = sheetsMock.data();
    const googleStatusRes = googleStatusMock.data();

    return res.json({
      success: true,
      data: {
        store: {
          id: req.store.id,
          name: req.store.name,
          shopDomain: req.store.shopDomain,
          email: req.store.email,
          status: req.store.status
        },
        productStats: productStatsRes?.data || null,
        syncConfigs: syncConfigsRes?.data || [],
        sheets: sheetsRes?.data || [],
        googleStatus: {
          connected:
            googleStatusRes?.data?.authenticated || googleStatusRes?.data?.connected || false
        }
      }
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Products - reuse existing controllers
router.post(
  '/products/upload-csv',
  (req, res, next) => {
    // Embedded: auto-inject storeIds from session
    if (req.store && !req.body.storeIds) {
      req.body.storeIds = [req.store.id];
    }
    next();
  },
  productImportController.uploadAndImport
);

router.get('/products/list', productImportController.getProducts);
router.get('/products/template', productImportController.downloadTemplate);
router.get('/products/queue-stats', productImportController.getQueueStats);
router.post('/products/process-queue', productImportController.processQueueManual);
router.get('/products/successful-imports', productImportController.getSuccessfulImports);

// Orders - wrap POST routes to ensure storeId/userId injection from session
router.post('/orders/setup-sync', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.store.id;
    req.body.userId = req.store.userId || req.userId || 'default-user';
  }
  return orderSyncController.setupSync(req, res);
});

router.post('/orders/manual-sync', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.store.id;
    req.body.userId = req.store.userId || req.userId || 'default-user';
  }
  return orderSyncController.manualSync(req, res);
});

router.get('/orders/sync-configs', orderSyncController.getSyncConfigs);
router.get('/orders/queue-stats', orderSyncController.getOrderSyncQueueStats);

// Google auth (wrapped to match frontend expected response shape)
router.get('/google/auth-url', async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = data => {
    if (data.success && data.data?.authUrl) {
      data.data.url = data.data.authUrl;
    }
    return originalJson(data);
  };
  return googleAuthController.getGoogleAuthUrl(req, res);
});

router.get('/google/status', async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = data => {
    if (data.success && data.data) {
      data.data.connected = data.data.authenticated || false;
    }
    return originalJson(data);
  };
  return googleAuthController.checkGoogleAuth(req, res);
});

router.post('/google/disconnect', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.store.id;
    req.body.userId = req.store.userId || req.userId || 'default-user';
  }
  return googleAuthController.disconnectGoogle(req, res);
});

router.get('/google/picker-token', googleAuthController.getPickerToken);

// Sheets - reuse existing controllers
router.get(
  '/sheets',
  (req, res, next) => {
    console.log('[embedRoutes] GET /sheets called');
    console.log('[embedRoutes] Query:', JSON.stringify(req.query));
    console.log('[embedRoutes] Store:', req.store?.id);
    next();
  },
  sheetController.getSheets
);
router.post(
  '/sheets',
  (req, res, next) => {
    console.log('[embedRoutes] POST /sheets called');
    console.log('[embedRoutes] Body:', JSON.stringify(req.body));
    console.log('[embedRoutes] Store:', req.store?.id);
    next();
  },
  sheetController.addSheetFromPicker
);
router.get('/sheets/:sheetId/tabs', sheetController.getSheetTabs);
router.get('/sheets/:sheetId', sheetController.getSheet);

export default router;
