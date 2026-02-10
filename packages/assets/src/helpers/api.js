import {isEmbeddedApp} from '../config/app';

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

  if (isEmbeddedApp && window.shopify) {
    const token = await window.shopify.idToken();
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
