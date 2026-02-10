import createApp from '@shopify/app-bridge';
import {Redirect} from '@shopify/app-bridge/actions';
import {getSessionToken} from '@shopify/app-bridge-utils';

let embedApp = null;
let initPromise = null;

/**
 * Get host parameter from URL
 */
export function getHost() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host');

  // Save to localStorage for development
  if (host && process.env.NODE_ENV !== 'production') {
    localStorage.setItem('shopify-host', host);
  }

  return host || localStorage.getItem('shopify-host') || '';
}

/**
 * Initialize App Bridge
 * @returns {Object|null} App Bridge app instance
 */
export function initAppBridge() {
  // Return existing promise if initialization is in progress
  if (initPromise) {
    console.log('[AppBridge] Initialization in progress, returning existing promise');
    return initPromise;
  }

  if (embedApp) {
    console.log('[AppBridge] Already initialized');
    return Promise.resolve(embedApp);
  }

  // Create initialization promise
  initPromise = new Promise((resolve, reject) => {
    const host = getHost();
    console.log('[AppBridge] Initializing with host:', host);
    if (!host) {
      console.warn('[AppBridge] No host parameter found for App Bridge');
      reject(new Error('No host parameter found'));
      return;
    }

    const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '3de04076a60f0c67a6ce18f5e7ff2b30';
    console.log('[AppBridge] Using API key:', apiKey?.substring(0, 8) + '...');

    try {
      embedApp = createApp({
        apiKey,
        host,
        forceRedirect: false
      });

      console.log('[AppBridge] App created successfully');

      // Set up global shopify object for compatibility
      window.shopify = {
        idToken: async () => {
          if (!embedApp) {
            console.error('[AppBridge] App Bridge not initialized');
            return null;
          }

          try {
            console.log('[AppBridge] Requesting session token...');
            // Use correct getSessionToken utility function from app-bridge-utils
            const token = await getSessionToken(embedApp);
            console.log('[AppBridge] Got session token, length:', token?.length, 'parts:', token?.split('.').length);
            return token;
          } catch (error) {
            console.error('[AppBridge] Failed to get session token:', error);
            return null;
          }
        }
      };

      console.log('[AppBridge] window.shopify.idToken set up');
      resolve(embedApp);
    } catch (error) {
      console.error('[AppBridge] Failed to create app:', error);
      reject(error);
    }
  });

  return initPromise;
}

/**
 * Get the App Bridge instance
 */
export function getAppBridge() {
  return embedApp;
}

/**
 * Check if reauthorization is needed
 */
export function checkHeadersForReauthorization(headers, app) {
  if (!app) return;

  if (headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const authUrl = headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
    if (authUrl) {
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.REMOTE, authUrl);
    }
  }
}
