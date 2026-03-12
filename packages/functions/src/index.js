import express from 'express';
import {onRequest} from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {initializeApp} from 'firebase-admin/app';

// Route modules
import authRoutes from './routes/authRoutes.js';
import shopifyInstallRoutes from './routes/shopifyInstallRoutes.js';
import googleAuthRoutes from './routes/googleAuthRoutes.js';
import sheetRoutes from './routes/sheetRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import themeRoutes from './routes/themeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import storeGroupRoutes from './routes/store-group-routes.js';
import setupRoutes from './routes/setupRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import embedRoutes from './routes/embedRoutes.js';
import gdprRoutes from './routes/gdprRoutes.js';
import multiAppAuthRoutes from './routes/multi-app-auth-routes.js';
import userRoutes from './routes/user-routes.js';
import * as devOrderInspectorController from './controllers/dev-order-inspector-controller.js';
import trackingStatusRoutes from './routes/tracking-status-routes.js';
import shippingTemplateRoutes from './routes/shipping-template-routes.js';
import * as trackingStatusController from './controllers/tracking-status-controller.js';
// Middleware
import {authentication} from './middleware/authentication.js';
// Controllers
import * as googleAuthController from './controllers/googleAuthController.js';
import * as webhookController from './controllers/webhookController.js';
import * as orderSyncController from './controllers/orderSyncController.js';
import * as productImportController from './controllers/productImportController.js';
import * as trackingImportController from './controllers/trackingImportController.js';

// BigQuery Firestore triggers
import {
  onTriggerStores,
  onTriggerGoogleAuth,
  onTriggerGoogleSheets,
  onTriggerProducts
} from './handlers/bigQueryTriggers.js';

// Initialize Firebase Admin
initializeApp();

const app = express();
app.set('trust proxy', true);

// ============ HEALTH CHECK ============
app.get('/', (req, res) => {
  res.json({success: true, message: 'ToolTrackingOrder API', version: '1.0.0'});
});

// ============ PUBLIC ROUTES (no auth) ============
// Shopify OAuth install flow (must come before authRoutes)
app.use('/api/auth/shopify', shopifyInstallRoutes);
app.use('/api/authMultip', multiAppAuthRoutes);
app.use('/api/auth', authRoutes);

// Shopify webhooks (called directly by Shopify)
// Note: app/uninstalled webhook is handled via shopifyInstallRoutes at /api/auth/shopify/webhook/app/uninstalled
app.post('/api/orders/webhook', orderSyncController.handleOrderWebhook);
app.post('/api/fulfillments/webhook', webhookController.handleFulfillmentWebhook);
app.post('/api/customers/webhook', webhookController.handleCustomerWebhook);
app.post('/api/shop/webhook', webhookController.handleShopWebhook);

// GDPR compliance webhooks (called directly by Shopify)
app.use('/api/gdpr', gdprRoutes);

// GDPR validation endpoint for embed path (Shopify validation)
app.all('/embed/api/gdpr*', (_req, res) => {
  res.status(401).json({
    success: false,
    error: 'Unauthorized - HMAC verification required'
  });
});

// Google OAuth exchange
app.post('/api/google/exchange', googleAuthController.exchangeGoogleCode);
app.post('/api/google/exchange-temp', googleAuthController.exchangeGoogleCodeTemp);

// ============ EMBEDDED APP ROUTES (session token auth) ============
app.use('/api/embed', embedRoutes);
// ============ AUTH MIDDLEWARE (JWT verification for all app routes) ============
app.use(authentication);

// ============ APP ROUTES ============
app.use('/api/users', userRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/store-groups', storeGroupRoutes);
app.use('/api/google', googleAuthRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/tracking-status', trackingStatusRoutes);
app.use('/api/shipping', shippingTemplateRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/api/dev/orders', devOrderInspectorController.getOrderData);

// ============ ERROR HANDLING ============
app.use((req, res) => {
  res
    .status(404)
    .json({success: false, error: 'Route not found', path: req.path, method: req.method});
});

app.use((err, req, res, _next) => {
  console.error('API Error:', err);
  res.status(500).json({success: false, error: err.message});
});

// ============ FIREBASE FUNCTION EXPORTS ============

/** Main API */
export const api = onRequest(
  {memory: '512MiB', cpu: 1, timeoutSeconds: 540, invoker: 'public', cors: true},
  app
);

/** PubSub: Product Import */
export const processProductImportQueue = onMessagePublished(
  {topic: 'product-import', memory: '256MiB', cpu: 1, timeoutSeconds: 540, retry: true},
  async event => {
    await productImportController.processProductImport(event.data);
  }
);

/** PubSub: Tracking Import */
export const processTrackingImportQueue = onMessagePublished(
  {
    topic: 'tracking-import',
    memory: '256MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retry: true
  },
  async event => {
    await trackingImportController.processTrackingImport(event.data);
  }
);

/** PubSub: Check Store Tracking (per-store background processing) */
export const processCheckStoreTracking = onMessagePublished(
  {topic: 'check-store-tracking', memory: '256MiB', cpu: 1, timeoutSeconds: 540, retry: true},
  async event => {
    await trackingStatusController.processStoreTracking(event.data);
  }
);

/** Cron: Process Product Queue (every 1 min) */
export const productQueueCron = onSchedule(
  {
    schedule: 'every 1 minutes',
    memory: '256MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retryConfig: {retryCount: 3, maxRetrySeconds: 600}
  },
  async () => {
    await productImportController.processProductQueue();
  }
);

/** Cron: Process Order Sync Queue (every 1 min) */
export const orderSyncQueueCron = onSchedule(
  {
    schedule: 'every 1 minutes',
    memory: '256MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retryConfig: {retryCount: 3, maxRetrySeconds: 600}
  },
  async () => {
    await orderSyncController.processOrderSyncQueue();
  }
);

/** Cron: Check tracking statuses via 17TRACK (every hour) */
export const trackingStatusCron = onSchedule(
  {
    schedule: 'every 60 minutes',
    memory: '256MiB',
    cpu: 1,
    timeoutSeconds: 540,
    retryConfig: {retryCount: 2, maxRetrySeconds: 600}
  },
  async () => {
    await trackingStatusController.processTrackingStatusQueue();
  }
);

/** Firestore Triggers -> BigQuery */
export const onWriteStores = onDocumentWritten(
  {document: 'shopify_stores/{docId}', memory: '256MiB', cpu: 1},
  onTriggerStores
);
export const onWriteGoogleAuth = onDocumentWritten(
  {document: 'google_auth/{docId}', memory: '256MiB', cpu: 1},
  onTriggerGoogleAuth
);
export const onWriteGoogleSheets = onDocumentWritten(
  {document: 'google_sheets/{docId}', memory: '256MiB', cpu: 1},
  onTriggerGoogleSheets
);
export const onWriteProducts = onDocumentWritten(
  {document: 'products/{docId}', memory: '256MiB', cpu: 1},
  onTriggerProducts
);
