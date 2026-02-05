import React, {useEffect, useState} from 'react';
import {Page, Layout, Card, Banner, Text, Spinner, BlockStack} from '@shopify/polaris';

/**
 * OAuth Callback Page
 * Handles the redirect from Shopify after OAuth authorization
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const shop = urlParams.get('shop');
        const state = urlParams.get('state');
        const hmac = urlParams.get('hmac');

        if (!code || !shop) {
          setError('Missing authorization code or shop parameter');
          setStatus('error');
          return;
        }

        // Send data to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'oauth-callback',
              code,
              shop,
              state,
              hmac
            },
            window.location.origin
          );

          setStatus('success');

          // Close window after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          setError('Parent window not found. Please close this window and try again.');
          setStatus('error');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    handleCallback();
  }, []);

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
                    <Text as="p">✓ Authorization successful!</Text>
                  </Banner>
                  <Text as="p">You can close this window now.</Text>
                  <Text as="p" tone="subdued">
                    This window will close automatically...
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
