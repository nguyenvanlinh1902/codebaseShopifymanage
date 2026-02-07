import express from 'express';
import {onRequest} from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {initializeApp} from 'firebase-admin/app';
import {injectUserId} from './middleware/injectUserId.js';

// Route modules
import oauthRoutes from './routes/oauthRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import googleAuthRoutes from './routes/googleAuthRoutes.js';
import sheetRoutes from './routes/sheetRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// PubSub controllers
import * as productImportController from './controllers/productImportController.js';
import * as trackingImportController from './controllers/trackingImportController.js';
import * as orderSyncController from './controllers/orderSyncController.js';

// BigQuery Firestore triggers
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {
  onTriggerStores,
  onTriggerGoogleAuth,
  onTriggerGoogleSheets,
  onTriggerProducts
} from './handlers/bigQueryTriggers.js';

// Initialize Firebase Admin
initializeApp();

const app = express();

// Global middleware
app.use(injectUserId);

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Shopify Google Sheets Integration API',
    version: '1.0.0'
  });
});

// Mount routers
app.use('/api/oauth', oauthRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/google', googleAuthRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('API Error:', err);
  res.status(500).json({success: false, error: err.message});
});

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
  app
);

/**
 * PubSub Handler: Process Product Import Queue
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

/**
 * Scheduled Function (CronJob): Process Order Sync Queue
 * Runs every minute to process pending orders from the queue
 */
export const orderSyncQueueCron = onSchedule(
  {
    schedule: 'every 1 minutes',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryConfig: {
      retryCount: 3,
      maxRetrySeconds: 600
    }
  },
  async () => {
    await orderSyncController.processOrderSyncQueue();
  }
);

/**
 * BigQuery Firestore Triggers
 */
export const onWriteStores = onDocumentWritten(
  {document: 'shopify_stores/{docId}', memory: '256MiB'},
  onTriggerStores
);

export const onWriteGoogleAuth = onDocumentWritten(
  {document: 'google_auth/{docId}', memory: '256MiB'},
  onTriggerGoogleAuth
);

export const onWriteGoogleSheets = onDocumentWritten(
  {document: 'google_sheets/{docId}', memory: '256MiB'},
  onTriggerGoogleSheets
);

export const onWriteProducts = onDocumentWritten(
  {document: 'products/{docId}', memory: '256MiB'},
  onTriggerProducts
);
