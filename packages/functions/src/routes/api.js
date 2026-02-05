import Router from 'koa-router';
import * as storeController from '../controllers/storeController.js';
import * as sheetController from '../controllers/sheetController.js';
import * as productController from '../controllers/productController.js';
import * as orderController from '../controllers/orderController.js';
import * as trackingController from '../controllers/trackingController.js';

const router = new Router({
  prefix: '/api'
});

/**
 * Helper to convert Express-style handlers to Koa middleware
 */
function convertHandler(handler) {
  return async ctx => {
    const req = {
      method: ctx.method,
      body: ctx.request.body,
      query: ctx.query,
      params: ctx.params
    };

    const res = {
      status: code => {
        ctx.status = code;
        return res;
      },
      json: data => {
        ctx.body = data;
      }
    };

    await handler(req, res);
  };
}

// ===== Store Routes =====
router.post('/stores', convertHandler(storeController.createStore));
router.get('/stores', convertHandler(storeController.getStores));
router.get('/stores/:storeId', convertHandler(storeController.getStore));
router.put('/stores/:storeId', convertHandler(storeController.updateStore));
router.delete('/stores/:storeId', convertHandler(storeController.deleteStore));

// ===== Sheet Routes =====
router.post('/sheets/auth-url', convertHandler(sheetController.getAuthUrl));
router.post('/sheets/connect', convertHandler(sheetController.connectSheet));
router.get('/sheets', convertHandler(sheetController.getSheets));
router.get('/sheets/:sheetId', convertHandler(sheetController.getSheet));
router.delete('/sheets/:sheetId', convertHandler(sheetController.deleteSheet));
router.get('/sheets/preview', convertHandler(sheetController.previewSheetData));

// ===== Product Routes =====
router.post('/products/import', convertHandler(productController.importProducts));
router.get('/products/jobs/:jobId', convertHandler(productController.getJobStatus));
router.get('/products/jobs', convertHandler(productController.getJobs));

// ===== Order Routes =====
router.post('/orders/sync', convertHandler(orderController.syncOrders));
router.get('/orders', convertHandler(orderController.getOrders));
router.post('/orders/schedule', convertHandler(orderController.scheduleOrderSync));

// ===== Tracking Routes =====
router.post('/tracking/update', convertHandler(trackingController.updateTracking));
router.get('/tracking/preview', convertHandler(trackingController.previewTracking));
router.get('/tracking/fulfillments', convertHandler(trackingController.getOrderFulfillments));

export default router;
