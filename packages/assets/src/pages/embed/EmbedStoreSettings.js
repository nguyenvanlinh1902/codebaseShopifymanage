import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  SkeletonBodyText,
  Box,
  Divider,
  Icon,
  Spinner
} from '@shopify/polaris';
import {NoteIcon, CheckCircleIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

export default function EmbedStoreSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(true);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      setCheckingGoogle(true);
      const res = await api('/api/embed/google/status');
      const data = await res.json();
      if (data.success && data.data) {
        setGoogleConnected(data.data.connected || data.data.authenticated || false);
        setGoogleEmail(data.data.googleEmail || '');
      }
    } catch (err) {
      console.error('Google status error:', err);
    } finally {
      setCheckingGoogle(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchGoogleStatus();
      setLoading(false);
    };
    load();
  }, [fetchGoogleStatus]);

  const handleConnectGoogle = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const response = await api('/api/embed/google/auth-url');
      const data = await response.json();
      if (data.success && data.data?.url) {
        window.open(data.data.url, '_blank');
        // Poll for connection status after user completes OAuth
        const pollInterval = setInterval(async () => {
          try {
            const checkRes = await api('/api/embed/google/status');
            const checkData = await checkRes.json();
            if (checkData.success && (checkData.data?.connected || checkData.data?.authenticated)) {
              setGoogleConnected(true);
              setGoogleEmail(checkData.data.googleEmail || '');
              setSuccessMessage('Google account connected successfully!');
              clearInterval(pollInterval);
              setGoogleLoading(false);
            }
          } catch {
            // keep polling
          }
        }, 3000);
        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setGoogleLoading(false);
        }, 120000);
      } else {
        setError('Unable to get Google authorization URL');
        setGoogleLoading(false);
      }
    } catch (err) {
      setError('Failed to connect Google account');
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <Page title="Settings">
        <Layout>
          <Layout.AnnotatedSection title="Google Sheets" description="Connect your Google account">
            <Card>
              <BlockStack gap="400">
                <SkeletonBodyText lines={4} />
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Settings" subtitle="Manage your Google Sheets connection">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Banner>
          </Layout.Section>
        )}

        {/* Google Sheets Connection (Beta) */}
        <Layout.AnnotatedSection
          title={
            <InlineStack gap="200" blockAlign="center">
              <Text variant="headingMd" as="h2">Google Sheets</Text>
              <Badge tone="info">Beta</Badge>
            </InlineStack>
          }
          description="Connect your Google account to sync orders to Google Sheets. This feature is currently in beta."
        >
          <Card>
            {checkingGoogle ? (
              <InlineStack gap="300" blockAlign="center">
                <Spinner size="small" />
                <Text variant="bodySm" tone="subdued">Checking connection...</Text>
              </InlineStack>
            ) : googleConnected ? (
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                    <Icon source={CheckCircleIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Connected</Text>
                    {googleEmail && (
                      <Text variant="bodySm" tone="subdued">{googleEmail}</Text>
                    )}
                  </BlockStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Your Google account is linked for order syncing.
                  </Text>
                  <Button
                    onClick={handleConnectGoogle}
                    loading={googleLoading}
                    size="slim"
                  >
                    Reconnect
                  </Button>
                </InlineStack>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box background="bg-fill-caution-secondary" borderRadius="300" padding="200">
                    <Icon source={NoteIcon} />
                  </Box>
                  <BlockStack gap="050">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Not Connected</Text>
                    <Text variant="bodySm" tone="subdued">
                      Connect your Google account to enable order sync to Sheets.
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button
                  variant="primary"
                  onClick={handleConnectGoogle}
                  loading={googleLoading}
                >
                  Connect Google Account
                </Button>
              </BlockStack>
            )}
          </Card>
        </Layout.AnnotatedSection>

      </Layout>
    </Page>
  );
}
