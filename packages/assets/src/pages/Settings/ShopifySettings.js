import React, {useState, useCallback, useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  Badge,
  Banner,
  Spinner,
  Divider,
  Box
} from '@shopify/polaris';
import {format} from 'date-fns';
import useFetchApi from '@assets/hooks/api/useFetchApi';
import useCreateApi from '@assets/hooks/api/useCreateApi';

/**
 * Shopify connection settings component
 */
export default function ShopifySettings() {
  const location = useLocation();
  const [shopDomain, setShopDomain] = useState('');
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [notification, setNotification] = useState(null);

  const {data: statusData, loading: statusLoading, fetchApi: refetchStatus} = useFetchApi({
    url: '/api/v1/chatty/shopify/status',
    defaultData: {isConnected: false}
  });

  const {creating: connecting, handleCreate: initiateAuth} = useCreateApi({
    url: '/api/v1/chatty/shopify/auth',
    successMsg: 'Redirecting to Shopify...'
  });

  const {creating: disconnecting, handleCreate: disconnect} = useCreateApi({
    url: '/api/v1/chatty/shopify/disconnect',
    successMsg: 'Shopify disconnected',
    successCallback: () => refetchStatus()
  });

  const {creating: syncing, handleCreate: triggerSync} = useCreateApi({
    url: '/api/v1/chatty/shopify/sync',
    successMsg: 'Sync started'
  });

  // Check for URL params from callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const connected = params.get('connected');

    if (error) {
      setNotification({
        tone: 'critical',
        message: decodeURIComponent(error)
      });
    } else if (connected === 'true') {
      setNotification({
        tone: 'success',
        message: 'Shopify connected successfully! Initial sync is in progress.'
      });
      refetchStatus();
    }

    // Clear URL params
    if (error || connected) {
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location, refetchStatus]);

  const handleConnect = useCallback(async () => {
    if (!shopDomain.trim()) {
      setNotification({
        tone: 'critical',
        message: 'Please enter your Shopify store domain'
      });
      return;
    }

    // Normalize domain
    let domain = shopDomain.trim().toLowerCase();
    if (!domain.includes('.myshopify.com')) {
      domain = `${domain}.myshopify.com`;
    }

    const response = await initiateAuth({shop: domain});
    if (response?.data?.authUrl) {
      window.location.href = response.data.authUrl;
    }
  }, [shopDomain, initiateAuth]);

  const handleDisconnect = useCallback(async () => {
    await disconnect({});
  }, [disconnect]);

  const handleSync = useCallback(async () => {
    await triggerSync({});
  }, [triggerSync]);

  if (statusLoading) {
    return (
      <Card>
        <div style={{padding: '40px', textAlign: 'center'}}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  const {isConnected, shop, connectedAt, lastSyncAt, scopes} = statusData;

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd">Shopify Connection</Text>

        {notification && (
          <Banner
            tone={notification.tone}
            onDismiss={() => setNotification(null)}
          >
            {notification.message}
          </Banner>
        )}

        {isConnected ? (
          <>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="success">Connected</Badge>
              <Text variant="bodyMd">{shop}</Text>
            </InlineStack>

            <Divider />

            <BlockStack gap="200">
              <InlineStack blockAlign="center">
                <Text variant="bodySm" tone="subdued">Connected since</Text>
                <div style={{flex: 1}} />
                <Text variant="bodySm">
                  {connectedAt ? format(new Date(connectedAt), 'MMM d, yyyy h:mm a') : 'Unknown'}
                </Text>
              </InlineStack>

              <InlineStack blockAlign="center">
                <Text variant="bodySm" tone="subdued">Last sync</Text>
                <div style={{flex: 1}} />
                <Text variant="bodySm">
                  {lastSyncAt ? format(new Date(lastSyncAt), 'MMM d, yyyy h:mm a') : 'Never'}
                </Text>
              </InlineStack>

              <InlineStack blockAlign="center">
                <Text variant="bodySm" tone="subdued">Permissions</Text>
                <div style={{flex: 1}} />
                <Text variant="bodySm">{scopes?.length || 0} granted</Text>
              </InlineStack>
            </BlockStack>

            <Divider />

            <InlineStack gap="200">
              <Button
                onClick={handleSync}
                loading={syncing}
              >
                Sync now
              </Button>
              <Button
                tone="critical"
                onClick={handleDisconnect}
                loading={disconnecting}
              >
                Disconnect
              </Button>
            </InlineStack>
          </>
        ) : (
          <>
            <Text variant="bodyMd" tone="subdued">
              Connect your Shopify store to sync customers and orders for better support context.
            </Text>

            <Box
              padding="300"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="200">
                <Text variant="bodySm" fontWeight="semibold">
                  Required permissions:
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodySm">- Read customers</Text>
                  <Text variant="bodySm">- Read orders</Text>
                  <Text variant="bodySm">- Read products</Text>
                  <Text variant="bodySm">- Read fulfillments</Text>
                </BlockStack>
              </BlockStack>
            </Box>

            {showDomainInput ? (
              <BlockStack gap="300">
                <TextField
                  label="Store domain"
                  value={shopDomain}
                  onChange={setShopDomain}
                  placeholder="mystore.myshopify.com"
                  helpText="Enter your Shopify store domain"
                  autoFocus
                />
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    onClick={handleConnect}
                    loading={connecting}
                    disabled={!shopDomain.trim()}
                  >
                    Connect to Shopify
                  </Button>
                  <Button onClick={() => setShowDomainInput(false)}>Cancel</Button>
                </InlineStack>
              </BlockStack>
            ) : (
              <Button variant="primary" onClick={() => setShowDomainInput(true)}>
                Connect Shopify Store
              </Button>
            )}
          </>
        )}
      </BlockStack>
    </Card>
  );
}
