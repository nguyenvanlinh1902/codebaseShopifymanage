import axios from 'axios';
import createApp from '@shopify/app-bridge';
import {Redirect} from '@shopify/app-bridge/actions';
import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getApiPrefix} from '@functions/const/app';
import isEmbeddedAppEnv from '@assets/helpers/isEmbeddedAppEnv';

/**
 * Firebase app instance initialized with environment configuration.
 * Used for authentication and other Firebase services.
 * @type {import('firebase/app').FirebaseApp}
 */
const app = initializeApp({
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
});

/**
 * Firebase Auth instance for user authentication.
 * Used in standalone mode (non-embedded) for Firebase token-based auth.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

/**
 * Shopify App Bridge instance for embedded app functionality.
 * Provides navigation, modal, and other Shopify admin integrations.
 * Will be undefined if not running in embedded mode.
 * @type {import('@shopify/app-bridge').ClientApplication | undefined}
 */
export const embedApp = createEmbedApp();

/**
 * Axios HTTP client with 60-second timeout.
 * Used for standalone mode API requests with Firebase auth.
 * @type {import('axios').AxiosInstance}
 */
export const client = axios.create({timeout: 60000});

/**
 * Universal API client that works in both embedded and standalone modes.
 * - Embedded mode: Uses fetch with Shopify session token auth
 * - Standalone mode: Uses axios with Firebase ID token auth
 * @type {(uri: string, options?: ApiRequestOptions) => Promise<any>}
 */
export const api = createApi();

/**
 * Gets the Shopify host parameter for App Bridge initialization.
 * In production, reads from URL query string.
 * In development, persists to localStorage for convenience.
 *
 * @returns {string|null} Base64-encoded Shopify admin host
 */
export function getHost() {
  const isProduction = import.meta.env.VITE_NODE_ENV === 'production';
  if (isProduction) {
    return new URLSearchParams(location.search).get('host');
  }

  const localStorageHost = localStorage.getItem('avada-dev-host');
  const host = new URLSearchParams(location.search).get('host') || localStorageHost;
  localStorage.setItem('avada-dev-host', host);

  return host;
}

/**
 * Creates and initializes Shopify App Bridge instance.
 * Only initializes when running in embedded mode with a valid host.
 *
 * @returns {import('@shopify/app-bridge').ClientApplication | undefined}
 * @private
 */
function createEmbedApp() {
  if (!isEmbeddedAppEnv) return;
  const host = getHost();
  if (!host) return;
  return createApp({
    host,
    forceRedirect: true,
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY
  });
}

/**
 * @typedef {Object} ApiRequestOptions
 * @property {Object} [headers] - Custom HTTP headers
 * @property {Object} [body] - Request body (will be JSON stringified)
 * @property {'GET'|'POST'|'PUT'|'DELETE'} [method='GET'] - HTTP method
 */

/**
 * Creates a universal API client that handles authentication automatically.
 *
 * In embedded mode:
 * - Uses native fetch API
 * - Shopify handles session token auth via App Bridge
 * - Checks for reauthorization headers on each response
 *
 * In standalone mode:
 * - Uses axios with Firebase ID token in x-auth-token header
 * - Requires user to be signed in via Firebase Auth
 *
 * @returns {(uri: string, options?: ApiRequestOptions) => Promise<any>}
 * @private
 */
function createApi() {
  const prefix = getApiPrefix(isEmbeddedAppEnv);

  if (isEmbeddedAppEnv) {
    const fetchFunction = fetch;
    return async (uri, options = {}) => {
      if (options.body) {
        options.body = JSON.stringify(options.body);
        options.headers = options.headers || {};
        options.headers['Content-Type'] = 'application/json';
      }
      const response = await fetchFunction(prefix + uri, options);
      checkHeadersForReauthorization(response.headers, embedApp);
      return await response.json();
    };
  }

  const sendRequest = async (uri, options) => {
    const idToken = await auth.currentUser.getIdToken(false);
    return client
      .request({
        ...options,
        headers: {
          accept: 'application/json',
          ...(options.headers || {}),
          'x-auth-token': idToken
        },
        url: prefix + uri,
        method: options.method,
        data: options.body
      })
      .then(res => res.data);
  };

  return async (uri, options = {}) => sendRequest(uri, options);
}

/**
 * Checks API response headers for Shopify reauthorization requirements.
 * When token refresh is needed, redirects user to the auth URL.
 *
 * This handles cases where the Shopify session token has expired
 * and the app needs to re-authenticate with Shopify.
 *
 * @param {Headers} headers - Response headers from fetch
 * @param {import('@shopify/app-bridge').ClientApplication} app - App Bridge instance
 * @private
 */
function checkHeadersForReauthorization(headers, app) {
  if (headers.get('X-Shopify-API-Request-Failure-Reauthorize') !== '1') {
    return;
  }
  const authUrlHeader = headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || `/api/auth`;
  const redirect = Redirect.create(app);
  redirect.dispatch(
    Redirect.Action.REMOTE,
    authUrlHeader.startsWith('/')
      ? `https://${window.location.host}${authUrlHeader}`
      : authUrlHeader
  );
}
