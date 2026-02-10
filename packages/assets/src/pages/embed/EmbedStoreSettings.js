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
import {useGoogleAuth} from '../../hooks/useGoogleAuth';

export default function EmbedStoreSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const {
    authenticated: googleConnected,
    googleEmail,
    loading: googleLoading,
    startAuth,
    checkAuth
  } = useGoogleAuth();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await checkAuth();
      setLoading(false);
    };
    load();
  }, [checkAuth]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      setError(null);
      await startAuth();
      setSuccessMessage('Google account connected successfully!');
    } catch (err) {
      // user cancelled or auth failed — already handled by useGoogleAuth
    }
    await checkAuth();
  }, [startAuth, checkAuth]);

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
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Banner>
          </Layout.Section>
        )}

        {/* Google Sheets Connection (Beta) */}
        <Layout.AnnotatedSection
          title={
            <InlineStack gap="200" blockAlign="center">
              <Text variant="headingMd" as="h2">
                Google Sheets
              </Text>
              <Badge tone="info">Beta</Badge>
            </InlineStack>
          }
          description="Connect your Google account to sync orders to Google Sheets. This feature is currently in beta."
        >
          <Card>
            {loading ? (
              <InlineStack gap="300" blockAlign="center">
                <Spinner size="small" />
                <Text variant="bodySm" tone="subdued">
                  Checking connection...
                </Text>
              </InlineStack>
            ) : googleConnected ? (
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                    <Icon source={CheckCircleIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Connected
                    </Text>
                    {googleEmail && (
                      <Text variant="bodySm" tone="subdued">
                        {googleEmail}
                      </Text>
                    )}
                  </BlockStack>
                </InlineStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">
                    Your Google account is linked for order syncing.
                  </Text>
                  <Button onClick={handleConnectGoogle} loading={googleLoading} size="slim">
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
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Not Connected
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Connect your Google account to enable order sync to Sheets.
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button variant="primary" onClick={handleConnectGoogle} loading={googleLoading}>
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
