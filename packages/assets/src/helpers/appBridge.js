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
 * Initialize App Bridge (CDN version loaded via embed.html)
 * The CDN script auto-sets window.shopify with .idToken() etc.
 */
export function initAppBridge() {
  if (initPromise) return initPromise;

  // CDN already ready
  if (window.shopify?.idToken) {
    console.log('[AppBridge] CDN already initialized');
    return Promise.resolve();
  }

  // Wait for CDN to initialize window.shopify
  initPromise = new Promise((resolve, reject) => {
    console.log('[AppBridge] Waiting for CDN App Bridge...');
    const startTime = Date.now();
    const timeout = 5000;

    const check = () => {
      if (window.shopify?.idToken) {
        console.log('[AppBridge] CDN ready');
        resolve();
        return;
      }
      if (Date.now() - startTime > timeout) {
        console.error('[AppBridge] Timeout waiting for CDN App Bridge');
        reject(new Error('App Bridge CDN timeout'));
        return;
      }
      setTimeout(check, 50);
    };
    check();
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
