import {onRequest} from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {initializeApp} from 'firebase-admin/app';
import * as storeController from './controllers/storeController.js';
import * as oauthController from './controllers/oauthController.js';
import * as sheetController from './controllers/sheetController.js';
import * as productImportController from './controllers/productImportController.js';
import * as orderController from './controllers/orderController.js';
import * as trackingController from './controllers/trackingController.js';
import * as trackingImportController from './controllers/trackingImportController.js';
import * as orderSyncController from './controllers/orderSyncController.js';

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

      // ===== OAuth Routes =====
      if (urlPath === '/api/oauth/auth-url' && method === 'POST') {
        return await oauthController.getAuthUrl(req, res);
      }

      if (urlPath === '/api/oauth/callback' && method === 'POST') {
        return await oauthController.handleCallback(req, res);
      }

      // ===== Store Routes =====
      if (urlPath === '/api/stores/verify-token' && method === 'POST') {
        return await storeController.verifyToken(req, res);
      }

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

      // ===== Product Import Routes (CSV + PubSub) =====
      if (urlPath === '/api/products/upload-csv' && method === 'POST') {
        return await productImportController.uploadAndImport(req, res);
      }

      if (urlPath === '/api/products/import-history' && method === 'GET') {
        return await productImportController.getImportHistory(req, res);
      }

      if (urlPath === '/api/products/successful-imports' && method === 'GET') {
        return await productImportController.getSuccessfulImports(req, res);
      }

      if (urlPath === '/api/products/list' && method === 'GET') {
        return await productImportController.getProducts(req, res);
      }

      if (urlPath === '/api/products/template' && method === 'GET') {
        return await productImportController.downloadTemplate(req, res);
      }

      if (urlPath === '/api/products/queue-stats' && method === 'GET') {
        return await productImportController.getQueueStats(req, res);
      }

      if (urlPath === '/api/products/process-queue' && method === 'POST') {
        return await productImportController.processQueueManual(req, res);
      }

      if (urlPath.startsWith('/api/products/imports/') && pathParts.length === 4) {
        const importId = pathParts[3];
        req.params = {importId};
        if (method === 'GET') return await productImportController.getImportDetails(req, res);
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

      // ===== Order Sync Routes (Shopify -> Google Sheets) =====
      if (urlPath === '/api/orders/setup-sync' && method === 'POST') {
        return await orderSyncController.setupSync(req, res);
      }

      if (urlPath === '/api/orders/manual-sync' && method === 'POST') {
        return await orderSyncController.manualSync(req, res);
      }

      if (urlPath === '/api/orders/sync-configs' && method === 'GET') {
        return await orderSyncController.getSyncConfigs(req, res);
      }

      if (urlPath === '/api/orders/register-webhook' && method === 'POST') {
        return await orderSyncController.registerWebhook(req, res);
      }

      if (urlPath === '/api/orders/webhook-instructions' && method === 'GET') {
        return await orderSyncController.getWebhookInstructions(req, res);
      }

      if (urlPath === '/api/orders/webhook-list' && method === 'GET') {
        return await orderSyncController.getWebhookList(req, res);
      }

      if (urlPath === '/api/orders/sync-stats' && method === 'GET') {
        return await orderSyncController.getSyncStats(req, res);
      }

      if (urlPath === '/api/orders/resync-failed' && method === 'POST') {
        return await orderSyncController.resyncFailedOrders(req, res);
      }

      // Webhook endpoint - receives orders from ALL stores
      if (urlPath === '/api/orders/webhook' && method === 'POST') {
        return await orderSyncController.handleOrderWebhook(req, res);
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

      // ===== Tracking Import Routes (Excel + PubSub) =====
      if (urlPath === '/api/tracking/upload-excel' && method === 'POST') {
        return await trackingImportController.uploadAndImport(req, res);
      }

      if (urlPath === '/api/tracking/import-history' && method === 'GET') {
        return await trackingImportController.getImportHistory(req, res);
      }

      if (urlPath === '/api/tracking/template' && method === 'GET') {
        return await trackingImportController.downloadTemplate(req, res);
      }

      if (urlPath.startsWith('/api/tracking/imports/') && pathParts.length === 4) {
        const importId = pathParts[3];
        req.params = {importId};
        if (method === 'GET') return await trackingImportController.getImportDetails(req, res);
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

/**
 * PubSub Handler: Process Product Import Queue
 * Triggered when a message is published to the product-import topic
 */
export const processProductImportQueue = onMessagePublished(
  {
    topic: 'product-import',
    memory: '512MiB',
    timeoutSeconds: 540,
    retry: true
  },
  async event => {
    await productImportController.processProductImport(event.data);
  }
);

/**
 * PubSub Handler: Process Tracking Import Queue
 * Triggered when a message is published to the tracking-import topic
 */
export const processTrackingImportQueue = onMessagePublished(
  {
    topic: 'tracking-import',
    memory: '512MiB',
    timeoutSeconds: 540,
    retry: true
  },
  async event => {
    await trackingImportController.processTrackingImport(event.data);
  }
);

/**
 * Scheduled Function (CronJob): Process Product Queue
 * Runs every minute to process pending products from the queue
 */
export const productQueueCron = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Ho_Chi_Minh',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryConfig: {
      retryCount: 3,
      maxRetrySeconds: 600
    }
  },
  async () => {
    await productImportController.processProductQueue();
  }
);
