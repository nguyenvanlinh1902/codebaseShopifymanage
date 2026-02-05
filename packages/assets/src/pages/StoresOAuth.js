import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Badge,
  Text,
  BlockStack,
  InlineStack
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Stores Management Page with OAuth Flow
 */
export default function StoresOAuth() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [step, setStep] = useState(1); // 1: Enter credentials, 2: Authorize, 3: Processing
  const [formData, setFormData] = useState({
    shopDomain: '',
    apiKey: '',
    apiSecret: '',
    name: '',
    niche: ''
  });
  const [authUrl, setAuthUrl] = useState('');
  const [authState, setAuthState] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [oauthWindow, setOauthWindow] = useState(null);

  useEffect(() => {
    fetchStores();
  }, []);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async event => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth-callback') {
        const {code, shop, state} = event.data;

        if (state !== authState) {
          setError('Invalid OAuth state. Please try again.');
          return;
        }

        // Close OAuth window
        if (oauthWindow && !oauthWindow.closed) {
          oauthWindow.close();
        }

        // Exchange code for token
        await handleOAuthCallback(code, shop);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authState, oauthWindow]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stores?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = useCallback(() => {
    setModalActive(true);
    setStep(1);
    setError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalActive(false);
    setFormData({shopDomain: '', apiKey: '', apiSecret: '', name: '', niche: ''});
    setStep(1);
    setAuthUrl('');
    setError(null);
    if (oauthWindow && !oauthWindow.closed) {
      oauthWindow.close();
    }
  }, [oauthWindow]);

  const handleGetAuthUrl = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // Get current domain for redirect
      const redirectUri = `${window.location.origin}/oauth/callback`;

      const response = await fetch('/api/oauth/auth-url', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          shopDomain: formData.shopDomain,
          apiKey: formData.apiKey,
          redirectUri
        })
      });

      const result = await response.json();

      if (result.success) {
        setAuthUrl(result.data.authUrl);
        setAuthState(result.data.state);
        setStep(2);
      } else {
        setError(result.error || 'Failed to generate authorization URL');
      }
    } catch (err) {
      console.error('Error getting auth URL:', err);
      setError('Failed to generate authorization URL');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAuthWindow = () => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const newWindow = window.open(
      authUrl,
      'shopify-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    setOauthWindow(newWindow);
    setStep(3);

    // Poll to check if window is closed
    const checkWindow = setInterval(() => {
      if (newWindow && newWindow.closed) {
        clearInterval(checkWindow);
        setStep(2); // Go back to step 2 if window closed without completing
      }
    }, 500);
  };

  const handleOAuthCallback = async (code, shop) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          code,
          shop,
          state: authState,
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          userId: USER_ID,
          storeName: formData.name,
          niche: formData.niche
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchStores();
        handleModalClose();
      } else {
        setError(result.error || 'Failed to connect store');
        setStep(2);
      }
    } catch (err) {
      console.error('Error in OAuth callback:', err);
      setError('Failed to connect store');
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async storeId => {
    if (!confirm('Are you sure you want to delete this store?')) return;

    try {
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await fetchStores();
      } else {
        alert(result.error || 'Failed to delete store');
      }
    } catch (err) {
      console.error('Error deleting store:', err);
      alert('Failed to delete store');
    }
  };

  const rows = stores.map(store => [
    store.name,
    store.shopDomain,
    store.niche || '-',
    <Badge tone={store.status === 'active' ? 'success' : 'warning'}>{store.status}</Badge>,
    <Button tone="critical" size="slim" onClick={() => handleDelete(store.id)}>
      Delete
    </Button>
  ]);

  return (
    <Page
      title="Shopify Stores"
      subtitle="Connect stores using OAuth"
      primaryAction={{
        content: 'Add Store',
        onAction: handleModalOpen
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : stores.length === 0 ? (
              <EmptyState
                heading="No stores connected"
                action={{content: 'Add Store', onAction: handleModalOpen}}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Connect your first Shopify store using OAuth.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Shop Domain', 'Niche', 'Status', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={handleModalClose}
        title="Connect Shopify Store via OAuth"
        primaryAction={
          step === 1
            ? {
                content: 'Get Authorization URL',
                onAction: handleGetAuthUrl,
                loading: submitting,
                disabled: !formData.shopDomain || !formData.apiKey || !formData.apiSecret
              }
            : step === 2
              ? {
                  content: 'Authorize Store',
                  onAction: handleOpenAuthWindow
                }
              : null
        }
        secondaryActions={[
          {
            content: step === 1 ? 'Cancel' : 'Back',
            onAction: step === 1 ? handleModalClose : () => setStep(1)
          }
        ]}
      >
        <Modal.Section>
          {step === 1 && (
            <FormLayout>
              <Banner>
                <BlockStack gap="200">
                  <Text as="p">
                    <strong>How to get API credentials:</strong>
                  </Text>
                  <Text as="p">1. Go to Shopify Admin → Settings → Apps and sales channels</Text>
                  <Text as="p">2. Click "Develop apps" → "Create an app"</Text>
                  <Text as="p">3. Configure Admin API scopes (products, orders, fulfillments)</Text>
                  <Text as="p">
                    4. Copy the <strong>API key</strong> and <strong>API secret key</strong>
                  </Text>
                </BlockStack>
              </Banner>

              <TextField
                label="Shop Domain"
                value={formData.shopDomain}
                onChange={value => setFormData({...formData, shopDomain: value})}
                placeholder="mystore.myshopify.com"
                helpText="Your Shopify store domain"
                required
                autoComplete="off"
              />

              <TextField
                label="API Key"
                value={formData.apiKey}
                onChange={value => setFormData({...formData, apiKey: value})}
                placeholder="abc123..."
                helpText="From your Custom App configuration"
                required
                autoComplete="off"
              />

              <TextField
                label="API Secret Key"
                value={formData.apiSecret}
                onChange={value => setFormData({...formData, apiSecret: value})}
                placeholder="shpss_..."
                helpText="From your Custom App configuration"
                type="password"
                required
                autoComplete="off"
              />

              <TextField
                label="Store Name (Optional)"
                value={formData.name}
                onChange={value => setFormData({...formData, name: value})}
                placeholder="My Store"
                helpText="A friendly name for your store"
                autoComplete="off"
              />

              <TextField
                label="Niche (Optional)"
                value={formData.niche}
                onChange={value => setFormData({...formData, niche: value})}
                placeholder="Electronics, Fashion, etc."
                helpText="Product niche or category"
                autoComplete="off"
              />
            </FormLayout>
          )}

          {step === 2 && (
            <BlockStack gap="400">
              <Banner tone="info">
                <Text as="p">Click the button below to authorize this app on your Shopify store.</Text>
              </Banner>

              <Text as="p">
                Store: <strong>{formData.shopDomain}</strong>
              </Text>

              <Text as="p" tone="subdued">
                You will be redirected to Shopify to approve the app's permissions. After approval, you'll be
                redirected back automatically.
              </Text>
            </BlockStack>
          )}

          {step === 3 && (
            <BlockStack gap="400">
              <Banner tone="success">
                <Text as="p">✓ Authorization window opened</Text>
              </Banner>

              <Text as="p">
                Please complete the authorization in the popup window. This modal will update automatically when
                complete.
              </Text>

              {submitting && (
                <InlineStack align="center">
                  <Text as="p">Processing authorization...</Text>
                </InlineStack>
              )}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
