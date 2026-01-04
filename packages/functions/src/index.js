import {onRequest} from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import apiHandler from './handlers/api';
import apiSaHandler from './handlers/apiSa';
import authHandler from './handlers/auth';
import authSaHandler from './handlers/authSa';
import embedAppHandler from './handlers/embed';
import webhookHandler from './handlers/webhook';
import clientApiHandler from './handlers/clientApi';
import subscribeBackgroundHandler from './handlers/subscribeBackgroundHandler';
import enqueueHandler from './handlers/enqueueHandler';
import dailyCronHandler from './handlers/schedule/dailyCron';

// ---------------------- Embed App ----------------------
// Serves the embedded app for theme app extensions
export const embedApp = onRequest(
  {
    memory: '512MiB',
    region: ['us-central1', 'us-east1', 'europe-west2', 'asia-northeast1'],
    invoker: 'public'
  },
  embedAppHandler.callback()
);

// ---------------------- API handlers ----------------------
// Main API endpoints for the embedded admin app
export const api = onRequest(
  {timeoutSeconds: 540, memory: '1GiB', invoker: 'public'},
  apiHandler.callback()
);

export const apiSa = onRequest(
  {timeoutSeconds: 540, memory: '1GiB', invoker: 'public'},
  apiSaHandler.callback()
);

// ---------------------- Auth handlers ----------------------
// OAuth flow and session management
export const auth = onRequest({memory: '1GiB', invoker: 'public'}, authHandler.callback());

export const authSa = onRequest({memory: '512MiB', invoker: 'public'}, authSaHandler.callback());

// ---------------------- Webhook handlers ----------------------
// Shopify webhook endpoints (HMAC verified)
export const webhook = onRequest(
  {timeoutSeconds: 30, memory: '512MiB', invoker: 'public'},
  webhookHandler.callback()
);

// ---------------------- Client API handlers ----------------------
// Public API for storefront scripts (CORS enabled)
export const clientApi = onRequest(
  {timeoutSeconds: 30, memory: '512MiB', invoker: 'public'},
  clientApiHandler.callback()
);

// ---------------------- PubSub handlers ----------------------
// Background processing via Pub/Sub messages
export const backgroundHandling = onMessagePublished(
  {topic: 'backgroundHandling', timeoutSeconds: 540, memory: '1GiB'},
  subscribeBackgroundHandler
);

// ---------------------- Cloud Tasks handlers ----------------------
// Delayed/scheduled task processing with retry and rate limiting
export const enqueueSubscriber = onTaskDispatched(
  {
    memory: '2GiB',
    timeoutSeconds: 120,
    retryConfig: {
      maxAttempts: 1 // No retries - Shopify will retry webhook if needed
    },
    rateLimits: {
      maxDispatchesPerSecond: 500,
      maxConcurrentDispatches: 1000
    }
  },
  enqueueHandler
);

// ---------------------- Schedule handlers ----------------------
// Cron jobs for periodic tasks
export const dailyCron = onSchedule(
  {schedule: '0 0 * * *', timeoutSeconds: 540, memory: '1GiB'},
  dailyCronHandler
);
