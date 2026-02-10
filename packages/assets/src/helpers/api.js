import {isEmbeddedApp} from '../config/app';

/**
 * Wait for App Bridge to be ready (window.shopify.idToken to be available)
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForAppBridge(timeout = 5000) {
  const startTime = Date.now();
  while (!window.shopify?.idToken) {
    if (Date.now() - startTime > timeout) {
      console.error('[API] Timeout waiting for App Bridge initialization');
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return true;
}

/**
 * Unified API fetch wrapper.
 * - Embedded mode: uses Shopify session token (App Bridge)
 * - Standalone mode: uses x-client-id header
 */
export async function api(url, options = {}) {
  const mergedOptions = {
    ...options,
    headers: {
      ...options.headers
    }
  };

  if (isEmbeddedApp) {
    // Wait for App Bridge to be ready
    const isReady = await waitForAppBridge();
    if (!isReady || !window.shopify) {
      console.error('[API] App Bridge not ready, cannot make authenticated request');
      throw new Error('App Bridge not initialized');
    }

    const token = await window.shopify.idToken();
    if (!token) {
      console.error('[API] Failed to get session token from App Bridge');
      throw new Error('Failed to get session token');
    }
    console.log('[API] Got session token, length:', token?.length);
    mergedOptions.headers.Authorization = `Bearer ${token}`;
  } else {
    mergedOptions.headers['x-client-id'] = 'default-user';
  }

  if (mergedOptions.body && !(mergedOptions.body instanceof FormData)) {
    mergedOptions.headers['Content-Type'] =
      mergedOptions.headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(url, mergedOptions);

  if (
    isEmbeddedApp &&
    response.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1'
  ) {
    const reauthorizeUrl = response.headers.get(
      'X-Shopify-API-Request-Failure-Reauthorize-Url'
    );
    if (reauthorizeUrl) {
      window.open(reauthorizeUrl, '_top');
      return response;
    }
  }

  return response;
}
