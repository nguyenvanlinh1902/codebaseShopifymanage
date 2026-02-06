import React, {useEffect, useState, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {Page, Layout, Card, Banner, Text, Spinner, BlockStack} from '@shopify/polaris';
import {USER_ID} from '../config/user';

/**
 * OAuth Callback Page
 * Handles redirects from both Shopify and Google OAuth
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-execution
    if (processedRef.current) return;
    processedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const shop = urlParams.get('shop');
    const stateRaw = urlParams.get('state');

    // Parse state to detect mode
    let mode = 'connect';
    if (stateRaw) {
      try {
        const parsed = JSON.parse(stateRaw);
        mode = parsed.mode || 'connect';
      } catch {
        // Legacy: state was just userId string
      }
    }

    if (shop) {
      handleShopifyCallback(urlParams);
    } else if (code && mode === 'temp') {
      handleGoogleCallbackTemp(code);
    } else if (code) {
      handleGoogleCallback(code);
    } else {
      setError('Missing authorization parameters');
      setStatus('error');
    }
  }, []);

  const handleShopifyCallback = urlParams => {
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

      // Send data to parent window (popup flow)
      if (window.opener) {
        window.opener.postMessage(
          {type: 'oauth-callback', code, shop, state, hmac},
          window.location.origin
        );
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
  };

  const handleGoogleCallback = async code => {
    try {
      const response = await fetch('/api/google/exchange', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code, userId: USER_ID})
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        // Notify parent window and close popup
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'google-auth-callback',
              success: true,
              googleEmail: result.data?.googleEmail || ''
            },
            window.location.origin
          );
          setTimeout(() => window.close(), 1500);
        } else {
          // Fallback: redirect if not in popup
          setTimeout(() => navigate('/sheets', {state: {authSuccess: true}}), 1500);
        }
      } else {
        setError(result.error || 'Failed to connect Google account');
        setStatus('error');
        if (window.opener) {
          window.opener.postMessage(
            {type: 'google-auth-callback', success: false, error: result.error},
            window.location.origin
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
          window.location.origin
        );
      }
    }
  };

  const handleGoogleCallbackTemp = async code => {
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
            window.location.origin
          );
          setTimeout(() => window.close(), 1500);
        }
      } else {
        setError(result.error || 'Failed to authenticate');
        setStatus('error');
        if (window.opener) {
          window.opener.postMessage(
            {type: 'google-auth-temp', success: false, error: result.error},
            window.location.origin
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
          window.location.origin
        );
      }
    }
  };

  return (
    <Page title="OAuth Authorization">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400" align="center">
              {status === 'processing' && (
                <>
                  <Spinner size="large" />
                  <Text as="p">Processing authorization...</Text>
                  <Text as="p" tone="subdued">
                    Please wait while we complete the connection.
                  </Text>
                </>
              )}

              {status === 'success' && (
                <>
                  <Banner tone="success">
                    <Text as="p">Authorization successful!</Text>
                  </Banner>
                  <Text as="p" tone="subdued">
                    {window.opener ? 'This window will close automatically...' : 'Redirecting...'}
                  </Text>
                </>
              )}

              {status === 'error' && (
                <>
                  <Banner tone="critical">
                    <Text as="p">Authorization failed</Text>
                  </Banner>
                  {error && <Text as="p">{error}</Text>}
                  <Text as="p" tone="subdued">
                    Please close this window and try again.
                  </Text>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
