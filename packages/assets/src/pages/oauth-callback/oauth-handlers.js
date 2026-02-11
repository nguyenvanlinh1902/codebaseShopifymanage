/**
 * OAuth callback handler utilities
 * Handles Google OAuth flows (Shopify OAuth is handled server-side by shopifyInstallController)
 */

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
