import {onRequest} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import * as storeController from './controllers/storeController.js';
import * as sheetController from './controllers/sheetController.js';
import * as productController from './controllers/productController.js';
import * as orderController from './controllers/orderController.js';
import * as trackingController from './controllers/trackingController.js';

// Initialize Firebase Admin
initializeApp();

/**
 * Main API endpoint
 */
export const api = onRequest(
  {
    memory: '1GiB',
    timeoutSeconds: 300,
    invoker: 'public',
    cors: true
  },
  async (req, res) => {
    try {
      // Enable CORS
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }

      const {method, url} = req;
      const urlPath = url.split('?')[0];

      // Parse route params
      const pathParts = urlPath.split('/').filter(p => p);

      // ===== Health Check =====
      if (method === 'GET' && urlPath === '/') {
        return res.json({
          success: true,
          message: 'Shopify Google Sheets Integration API',
          version: '1.0.0',
          endpoints: {
            stores: '/api/stores',
            sheets: '/api/sheets',
            products: '/api/products',
            orders: '/api/orders',
            tracking: '/api/tracking'
          }
        });
      }

      // ===== Store Routes =====
      if (urlPath === '/api/stores') {
        if (method === 'POST') return await storeController.createStore(req, res);
        if (method === 'GET') return await storeController.getStores(req, res);
      }

      if (urlPath.startsWith('/api/stores/') && pathParts.length === 3) {
        const storeId = pathParts[2];
        req.params = {storeId};
        if (method === 'GET') return await storeController.getStore(req, res);
        if (method === 'PUT') return await storeController.updateStore(req, res);
        if (method === 'DELETE') return await storeController.deleteStore(req, res);
      }

      // ===== Sheet Routes =====
      if (urlPath === '/api/sheets/auth-url' && method === 'POST') {
        return await sheetController.getAuthUrl(req, res);
      }

      if (urlPath === '/api/sheets/connect' && method === 'POST') {
        return await sheetController.connectSheet(req, res);
      }

      if (urlPath === '/api/sheets') {
        if (method === 'GET') return await sheetController.getSheets(req, res);
      }

      if (urlPath === '/api/sheets/preview' && method === 'GET') {
        return await sheetController.previewSheetData(req, res);
      }

      if (urlPath.startsWith('/api/sheets/') && pathParts.length === 3) {
        const sheetId = pathParts[2];
        req.params = {sheetId};
        if (method === 'GET') return await sheetController.getSheet(req, res);
        if (method === 'DELETE') return await sheetController.deleteSheet(req, res);
      }

      // ===== Product Routes =====
      if (urlPath === '/api/products/import' && method === 'POST') {
        return await productController.importProducts(req, res);
      }

      if (urlPath === '/api/products/jobs' && method === 'GET') {
        return await productController.getJobs(req, res);
      }

      if (urlPath.startsWith('/api/products/jobs/') && pathParts.length === 4) {
        const jobId = pathParts[3];
        req.params = {jobId};
        if (method === 'GET') return await productController.getJobStatus(req, res);
      }

      // ===== Order Routes =====
      if (urlPath === '/api/orders/sync' && method === 'POST') {
        return await orderController.syncOrders(req, res);
      }

      if (urlPath === '/api/orders/schedule' && method === 'POST') {
        return await orderController.scheduleOrderSync(req, res);
      }

      if (urlPath === '/api/orders' && method === 'GET') {
        return await orderController.getOrders(req, res);
      }

      // ===== Tracking Routes =====
      if (urlPath === '/api/tracking/update' && method === 'POST') {
        return await trackingController.updateTracking(req, res);
      }

      if (urlPath === '/api/tracking/preview' && method === 'GET') {
        return await trackingController.previewTracking(req, res);
      }

      if (urlPath === '/api/tracking/fulfillments' && method === 'GET') {
        return await trackingController.getOrderFulfillments(req, res);
      }

      // Default 404
      return res.status(404).json({
        success: false,
        error: 'Route not found',
        path: urlPath,
        method
      });
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
