let initPromise = null;

/**
 * Get host parameter from URL
 */
export function getHost() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host');

  if (host && process.env.NODE_ENV !== 'production') {
    localStorage.setItem('shopify-host', host);
  }

  return host || localStorage.getItem('shopify-host') || '';
}

/**
 * Initialize App Bridge (CDN version loaded via HTML)
 * The CDN script auto-sets window.shopify with .idToken() etc.
 */
export function initAppBridge() {
  if (initPromise) return initPromise;

  if (window.shopify?.idToken) {
    return Promise.resolve();
  }

  initPromise = new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = 5000;

    const check = () => {
      if (window.shopify?.idToken) {
        resolve();
        return;
      }
      if (Date.now() - startTime > timeout) {
        reject(new Error('App Bridge CDN timeout'));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  }).catch(err => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/**
 * Check if reauthorization is needed
 */
export function checkHeadersForReauthorization(headers) {
  if (headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const authUrl = headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
    if (authUrl) {
      window.open(authUrl, '_top');
    }
  }
}
