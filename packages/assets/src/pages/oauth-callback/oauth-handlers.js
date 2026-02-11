/**
 * OAuth callback handler utilities
 * Handles Shopify, Google, and Google temp OAuth flows
 */

export function handleShopifyCallback(urlParams, {setError, setStatus}) {
  try {
    const code = urlParams.get('code');
    const shop = urlParams.get('shop');
    const state = urlParams.get('state');
    const hmac = urlParams.get('hmac');

    if (!code || !shop) {
      setError('Missing authorization code or shop parameter');
      setStatus('error');
      return;
    }

    if (window.opener) {
      window.opener.postMessage({type: 'oauth-callback', code, shop, state, hmac}, '*');
      setStatus('success');
      setTimeout(() => window.close(), 2000);
    } else {
      setError('Parent window not found. Please close this window and try again.');
      setStatus('error');
    }
  } catch (err) {
    console.error('Shopify OAuth callback error:', err);
    setError(err.message);
    setStatus('error');
  }
}

export async function handleGoogleCallback(code, userId, storeId, {setError, setStatus, navigate}) {
  try {
    const response = await fetch('/api/google/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code, userId, storeId})
    });

    const result = await response.json();

    if (result.success) {
      setStatus('success');
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'google-auth-callback',
            success: true,
            googleEmail: result.data?.googleEmail || ''
          },
          '*'
        );
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(() => navigate('/sheets', {state: {authSuccess: true}}), 1500);
      }
    } else {
      setError(result.error || 'Failed to connect Google account');
      setStatus('error');
      if (window.opener) {
        window.opener.postMessage(
          {type: 'google-auth-callback', success: false, error: result.error},
          '*'
        );
      }
    }
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    setError('Failed to connect Google account');
    setStatus('error');
    if (window.opener) {
      window.opener.postMessage(
        {type: 'google-auth-callback', success: false, error: 'Failed to connect Google account'},
        '*'
      );
    }
  }
}

export async function handleGoogleCallbackTemp(code, {setError, setStatus}) {
  try {
    const response = await fetch('/api/google/exchange-temp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code})
    });

    const result = await response.json();

    if (result.success) {
      setStatus('success');
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'google-auth-temp',
            success: true,
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken,
            googleEmail: result.data.googleEmail || ''
          },
          '*'
        );
        setTimeout(() => window.close(), 1500);
      }
    } else {
      setError(result.error || 'Failed to authenticate');
      setStatus('error');
      if (window.opener) {
        window.opener.postMessage(
          {type: 'google-auth-temp', success: false, error: result.error},
          '*'
        );
      }
    }
  } catch (err) {
    console.error('Google OAuth temp callback error:', err);
    setError('Failed to authenticate');
    setStatus('error');
    if (window.opener) {
      window.opener.postMessage(
        {type: 'google-auth-temp', success: false, error: 'Failed to authenticate'},
        '*'
      );
    }
  }
}
