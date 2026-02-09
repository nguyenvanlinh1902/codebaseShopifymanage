import React, {useState, useEffect, useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Icon,
  SkeletonBodyText,
  SkeletonDisplayText,
  Banner
} from '@shopify/polaris';
import {
  ProductIcon,
  OrderIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  NoteIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

export default function EmbedDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [productStats, setProductStats] = useState(null);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [storeRes, productRes, configRes, sheetsRes] = await Promise.all([
        api('/api/embed/store'),
        api('/api/embed/products/queue-stats'),
        api('/api/embed/orders/sync-configs'),
        api('/api/embed/sheets')
      ]);

      const [storeData, productData, configData, sheetsData] = await Promise.all([
        storeRes.json(),
        productRes.json(),
        configRes.json(),
        sheetsRes.json()
      ]);

      if (storeData.success) setStore(storeData.data);
      if (productData.success) setProductStats(productData.data);
      if (configData.success) setSyncConfigs(configData.data || []);
      if (sheetsData.success) setSheets(sheetsData.data || []);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeSync = syncConfigs.find(c => c.status === 'active');
  const totalSynced = syncConfigs.reduce((sum, c) => sum + (c.totalOrdersSynced || 0), 0);

  if (loading) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={3} />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{flex: 1}}>
                  <Card>
                    <SkeletonBodyText lines={3} />
                  </Card>
                </div>
              ))}
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}

        {/* Store Info */}
        {store && (
          <Layout.Section>
            <Card>
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">{store.name || store.shopDomain}</Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    {store.shopDomain}.myshopify.com
                  </Text>
                </BlockStack>
                <Badge tone="success">Connected</Badge>
              </InlineStack>
            </Card>
          </Layout.Section>
        )}

        {/* Stats Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            {/* Products */}
            <div style={{flex: 1}}>
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" as="p" tone="subdued">Products Imported</Text>
                    <Box
                      background="bg-fill-info"
                      borderRadius="200"
                      padding="100"
                      minWidth="36px"
                      minHeight="36px"
                    >
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <Icon source={ProductIcon} tone="info" />
                      </div>
                    </Box>
                  </InlineStack>
                  <Text variant="heading2xl" as="p">
                    {productStats ? (productStats.completed || 0).toLocaleString() : '0'}
                  </Text>
                  {productStats && productStats.pending > 0 && (
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={ClockIcon} tone="caution" />
                      <Text variant="bodySm" as="p" tone="subdued">
                        {productStats.pending} pending in queue
                      </Text>
                    </InlineStack>
                  )}
                  {productStats && productStats.failed > 0 && (
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={AlertCircleIcon} tone="critical" />
                      <Text variant="bodySm" as="p" tone="critical">
                        {productStats.failed} failed
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>
            </div>

            {/* Orders */}
            <div style={{flex: 1}}>
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" as="p" tone="subdued">Orders Synced</Text>
                    <Box
                      background="bg-fill-success"
                      borderRadius="200"
                      padding="100"
                      minWidth="36px"
                      minHeight="36px"
                    >
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <Icon source={OrderIcon} tone="success" />
                      </div>
                    </Box>
                  </InlineStack>
                  <Text variant="heading2xl" as="p">
                    {totalSynced.toLocaleString()}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon
                      source={activeSync ? CheckCircleIcon : ClockIcon}
                      tone={activeSync ? 'success' : 'subdued'}
                    />
                    <Text variant="bodySm" as="p" tone={activeSync ? 'success' : 'subdued'}>
                      {activeSync ? 'Sync active' : 'Not configured'}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>
            </div>

            {/* Sheets */}
            <div style={{flex: 1}}>
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" as="p" tone="subdued">Google Sheets</Text>
                    <Box
                      background="bg-fill-warning"
                      borderRadius="200"
                      padding="100"
                      minWidth="36px"
                      minHeight="36px"
                    >
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <Icon source={NoteIcon} tone="caution" />
                      </div>
                    </Box>
                  </InlineStack>
                  <Text variant="heading2xl" as="p">
                    {sheets.length}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon
                      source={sheets.length > 0 ? CheckCircleIcon : ClockIcon}
                      tone={sheets.length > 0 ? 'success' : 'subdued'}
                    />
                    <Text variant="bodySm" as="p" tone={sheets.length > 0 ? 'success' : 'subdued'}>
                      {sheets.length > 0 ? 'Connected' : 'Not connected'}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>
            </div>
          </InlineStack>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Quick Actions</Text>

              <InlineStack gap="400" wrap>
                <div style={{flex: 1, minWidth: 200}}>
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={ProductIcon} tone="base" />
                        <Text variant="headingSm" as="h3">Import Products</Text>
                      </InlineStack>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Upload CSV files to import products into your Shopify store.
                      </Text>
                      <Button onClick={() => navigate('/products')} variant="primary">
                        Go to Products
                      </Button>
                    </BlockStack>
                  </Card>
                </div>

                <div style={{flex: 1, minWidth: 200}}>
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={OrderIcon} tone="base" />
                        <Text variant="headingSm" as="h3">Sync Orders</Text>
                      </InlineStack>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Export orders from Shopify to Google Sheets automatically.
                      </Text>
                      <Button onClick={() => navigate('/orders')}>
                        Go to Orders
                      </Button>
                    </BlockStack>
                  </Card>
                </div>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Last Sync Info */}
        {activeSync && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Active Sync</Text>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodyMd" as="p">
                      {activeSync.sheetName || 'Sheet'} / {activeSync.targetSheet || 'Tab'}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {activeSync.totalOrdersSynced || 0} orders synced
                      {activeSync.lastSyncAt &&
                        ` · Last: ${new Date(activeSync.lastSyncAt).toLocaleString()}`}
                    </Text>
                  </BlockStack>
                  <Badge tone="success">Active</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
