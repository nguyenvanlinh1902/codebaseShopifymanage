import {isEmbeddedApp} from '../config/app';
import {getAuthHeaders} from '../context/AuthContext';

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
    mergedOptions.headers.Authorization = `Bearer ${token}`;
  } else {
    Object.assign(mergedOptions.headers, getAuthHeaders());
  }

  if (mergedOptions.body && !(mergedOptions.body instanceof FormData)) {
    mergedOptions.headers['Content-Type'] =
      mergedOptions.headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(url, mergedOptions);

  // Auto-clear auth on 401 for standalone mode. Preserve the auth-failure
  // reason as a query param so the login page can surface a helpful message.
  if (!isEmbeddedApp && response.status === 401) {
    let reason = 'expired';
    try {
      const body = await response.clone().json();
      if (body?.code === 'SESSION_INVALIDATED') reason = 'permissions-changed';
      else if (body?.code === 'USER_INACTIVE') reason = 'inactive';
    } catch (_err) {
      // body not JSON — keep default reason
    }
    const {clearAuth} = await import('../context/AuthContext');
    clearAuth();
    window.location.href = `/?auth=${reason}`;
    return response;
  }

  if (isEmbeddedApp && response.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const reauthorizeUrl = response.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
    if (reauthorizeUrl) {
      window.open(reauthorizeUrl, '_top');
      return response;
    }
  }

  return response;
}
