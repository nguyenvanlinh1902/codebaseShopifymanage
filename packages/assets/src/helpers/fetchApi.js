import {getAuthHeaders, getRefreshToken, saveTokens, clearAuth} from '../context/AuthContext';

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuth();
    window.location.reload();
    throw new Error('No refresh token');
  }

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({refreshToken})
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    clearAuth();
    window.location.reload();
    throw new Error('Refresh failed');
  }

  saveTokens(result.data.token, result.data.refreshToken);
  return result.data.token;
}

/**
 * Wrapper around fetch() that auto-injects auth headers
 * and handles token refresh on 401.
 *
 * Usage: same as fetch()
 *   const res = await fetchApi('/api/stores?userId=xxx');
 *   const res = await fetchApi('/api/stores', { method: 'POST', body: ... });
 */
export async function fetchApi(url, options = {}) {
  const authHeaders = getAuthHeaders();

  const mergedOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  };

  // If body is not FormData, set Content-Type to json
  if (mergedOptions.body && !(mergedOptions.body instanceof FormData)) {
    mergedOptions.headers['Content-Type'] =
      mergedOptions.headers['Content-Type'] || 'application/json';
  }

  let response = await fetch(url, mergedOptions);

  // Handle token expired → refresh and retry once
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => ({}));

    if (body.code === 'TOKEN_EXPIRED') {
      // Prevent multiple concurrent refresh calls
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
      } catch {
        return response;
      }

      // Retry with new token
      const newAuthHeaders = getAuthHeaders();
      const retryOptions = {
        ...mergedOptions,
        headers: {
          ...mergedOptions.headers,
          ...newAuthHeaders
        }
      };
      response = await fetch(url, retryOptions);
    } else {
      // Not token expired - force logout
      clearAuth();
      window.location.reload();
    }
  }

  return response;
}
