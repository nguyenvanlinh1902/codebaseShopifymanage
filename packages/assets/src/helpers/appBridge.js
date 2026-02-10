import createApp from '@shopify/app-bridge';
import {Redirect} from '@shopify/app-bridge/actions';

let embedApp = null;

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
  if (embedApp) return embedApp;

  const host = getHost();
  if (!host) {
    console.warn('No host parameter found for App Bridge');
    return null;
  }

  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '3de04076a60f0c67a6ce18f5e7ff2b30';

  embedApp = createApp({
    apiKey,
    host,
    forceRedirect: false
  });

  // Set up global shopify object for compatibility
  window.shopify = {
    idToken: async () => {
      if (!embedApp) return null;

      try {
        const token = await new Promise((resolve, reject) => {
          // Get session token from App Bridge
          const unsubscribe = embedApp.subscribe('SessionToken', (data) => {
            if (data && data.token) {
              resolve(data.token);
              unsubscribe();
            }
          });

          // Request session token
          embedApp.getSessionToken?.().then(resolve).catch(reject);

          // Timeout after 5 seconds
          setTimeout(() => {
            unsubscribe();
            reject(new Error('Session token timeout'));
          }, 5000);
        });

        return token;
      } catch (error) {
        console.error('Failed to get session token:', error);
        return null;
      }
    }
  };

  return embedApp;
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
