import React, {useEffect, useState, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {Page, Layout, Card, Banner, Text, Spinner, BlockStack} from '@shopify/polaris';
import {
  handleGoogleCallback,
  handleGoogleCallbackTemp
} from './oauth-callback/oauth-handlers';

/**
 * OAuth Callback Page
 * Handles redirects from Google OAuth (Shopify OAuth is handled server-side)
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const stateRaw = urlParams.get('state');

    let mode = 'connect';
    let stateUserId = '';
    let stateStoreId = '';
    if (stateRaw) {
      try {
        const parsed = JSON.parse(stateRaw);
        mode = parsed.mode || 'connect';
        stateUserId = parsed.userId || '';
        stateStoreId = parsed.storeId || '';
      } catch {
        // Legacy: state was just userId string
      }
    }

    const handlers = {setError, setStatus, navigate};

    if (code && mode === 'temp') {
      handleGoogleCallbackTemp(code, handlers);
    } else if (code) {
      handleGoogleCallback(code, stateUserId, stateStoreId, handlers);
    } else {
      setError('Missing authorization parameters');
      setStatus('error');
    }
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
