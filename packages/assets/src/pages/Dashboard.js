import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  Icon,
  SkeletonBodyText,
  SkeletonDisplayText,
  ProgressBar,
  Collapsible,
  List
} from '@shopify/polaris';
import {
  StoreIcon,
  NoteIcon,
  OrderIcon,
  ProductIcon,
  DeliveryIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ExternalIcon
} from '@shopify/polaris-icons';
import {USER_ID} from '../config/user';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [openGuide, setOpenGuide] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes] = await Promise.all([
        fetch(`/api/stores?userId=${USER_ID}`),
        fetch(`/api/sheets?userId=${USER_ID}`)
      ]);
      const [storesData, sheetsData] = await Promise.all([
        storesRes.json(),
        sheetsRes.json()
      ]);

      const storeList = storesData.data || [];
      setStores(storeList);
      setSheets(sheetsData.data || []);

      // Fetch sync configs for all stores
      if (storeList.length > 0) {
        try {
          const configRes = await fetch(
            `/api/orders/sync-configs?userId=${USER_ID}`
          );
          const configData = await configRes.json();
          if (configData.success) setSyncConfigs(configData.data || []);
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleGuide = id => {
    setOpenGuide(prev => (prev === id ? null : id));
  };

  // Compute setup progress
  const hasStores = stores.length > 0;
  const hasSheets = sheets.length > 0;
  const hasOrderSync = syncConfigs.some(c => c.status === 'active');
  const steps = [hasStores, hasSheets, hasOrderSync];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = 5; // stores, sheets, orders, products, tracking
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  if (loading) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{flex: 1}}>
                  <Card>
                    <BlockStack gap="200">
                      <SkeletonDisplayText size="small" />
                      <SkeletonBodyText lines={2} />
                    </BlockStack>
                  </Card>
                </div>
              ))}
            </InlineStack>
          </Layout.Section>
          <Layout.Section>
            <Card><SkeletonBodyText lines={10} /></Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Dashboard"
      subtitle="Shopify - Google Sheets Integration"
    >
      <Layout>
        {/* Overview Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <StatCard
              title="Connected Stores"
              value={stores.length}
              icon={StoreIcon}
              color="#5c6ac4"
              done={hasStores}
            />
            <StatCard
              title="Google Sheets"
              value={sheets.length}
              icon={NoteIcon}
              color="#00a0ac"
              done={hasSheets}
            />
            <StatCard
              title="Order Sync"
              value={syncConfigs.filter(c => c.status === 'active').length}
              icon={OrderIcon}
              color="#9c6ade"
              done={hasOrderSync}
              label="active configs"
            />
          </InlineStack>
        </Layout.Section>

        {/* Setup Progress */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Setup Progress</Text>
                <Badge tone={completedSteps >= 3 ? 'success' : 'attention'}>
                  {completedSteps}/{totalSteps} completed
                </Badge>
              </InlineStack>
              <ProgressBar
                progress={progressPct}
                tone={progressPct >= 60 ? 'success' : 'primary'}
                size="small"
              />
              <Text variant="bodySm" as="p" tone="subdued">
                Complete all steps below to fully set up your multi-store integration.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Step 1: Connect Stores */}
        <Layout.Section>
          <GuideCard
            step={1}
            title="Connect Shopify Stores"
            description="Add your Shopify stores with API credentials to manage products, orders and tracking."
            icon={StoreIcon}
            color="#5c6ac4"
            done={hasStores}
            doneText={`${stores.length} store(s) connected`}
            pendingText="No stores connected"
            open={openGuide === 'stores'}
            onToggle={() => toggleGuide('stores')}
            actionLabel="Go to Stores"
            actionUrl="/stores"
          >
            <BlockStack gap="300">
              <Text variant="bodySm" as="p" fontWeight="semibold">How to connect a store:</Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Stores</strong> page and click <strong>"Add Store"</strong>
                </List.Item>
                <List.Item>
                  Enter your Shopify store domain (e.g. <code>my-store.myshopify.com</code>)
                </List.Item>
                <List.Item>
                  Provide your <strong>Admin API Access Token</strong> from Shopify Admin {'->'} Settings {'->'} Apps and sales channels {'->'} Develop apps
                </List.Item>
                <List.Item>
                  Click <strong>"Verify & Connect"</strong> to validate the credentials
                </List.Item>
              </List>

              <Divider />
              <Text variant="bodySm" as="p" fontWeight="semibold">How to get your Access Token:</Text>
              <List type="number">
                <List.Item>
                  In Shopify Admin, go to <strong>Settings {'->'} Apps and sales channels</strong>
                </List.Item>
                <List.Item>
                  Click <strong>"Develop apps"</strong>, then <strong>"Create an app"</strong>
                </List.Item>
                <List.Item>
                  Under <strong>API credentials</strong>, configure the required scopes:
                  <br />
                  <code>read_orders, write_orders, read_products, write_products, read_shipping, write_shipping</code>
                </List.Item>
                <List.Item>
                  Install the app and copy the <strong>Admin API access token</strong>
                </List.Item>
              </List>

              {hasStores && (
                <>
                  <Divider />
                  <Text variant="bodySm" as="p" fontWeight="semibold">Your stores:</Text>
                  <BlockStack gap="200">
                    {stores.map(store => (
                      <Box key={store.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text variant="bodySm" as="p" fontWeight="semibold">{store.name}</Text>
                            <Text variant="bodySm" as="p" tone="subdued">{store.shopDomain}.myshopify.com</Text>
                          </BlockStack>
                          <Badge tone="success">Connected</Badge>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </GuideCard>
        </Layout.Section>

        {/* Step 2: Google Sheets */}
        <Layout.Section>
          <GuideCard
            step={2}
            title="Connect Google Sheets"
            description="Authorize your Google account and link spreadsheets for data sync."
            icon={NoteIcon}
            color="#00a0ac"
            done={hasSheets}
            doneText={`${sheets.length} sheet(s) connected`}
            pendingText="No sheets connected"
            open={openGuide === 'sheets'}
            onToggle={() => toggleGuide('sheets')}
            actionLabel="Go to Sheets"
            actionUrl="/sheets"
          >
            <BlockStack gap="300">
              <Text variant="bodySm" as="p" fontWeight="semibold">How to connect Google Sheets:</Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Google Sheets</strong> page
                </List.Item>
                <List.Item>
                  Click <strong>"Connect Google Account"</strong> and authorize access
                </List.Item>
                <List.Item>
                  Once connected, click <strong>"Add Sheet"</strong> and select a spreadsheet using the Google Picker
                </List.Item>
                <List.Item>
                  The sheet will appear in your connected sheets list
                </List.Item>
              </List>

              <Divider />
              <Banner tone="info">
                <p>
                  You can connect multiple Google accounts and add sheets from each.
                  Sheets are used as the destination for order exports and the source for product/tracking imports.
                </p>
              </Banner>
            </BlockStack>
          </GuideCard>
        </Layout.Section>

        {/* Step 3: Order Sync */}
        <Layout.Section>
          <GuideCard
            step={3}
            title="Setup Order Sync"
            description="Export orders from Shopify to Google Sheets automatically via webhooks, or trigger manual sync."
            icon={OrderIcon}
            color="#9c6ade"
            done={hasOrderSync}
            doneText={`${syncConfigs.filter(c => c.status === 'active').length} active sync config(s)`}
            pendingText="Not configured"
            open={openGuide === 'orders'}
            onToggle={() => toggleGuide('orders')}
            actionLabel="Go to Orders"
            actionUrl="/orders"
          >
            <BlockStack gap="300">
              <Text variant="bodySm" as="p" fontWeight="semibold">How to setup order sync:</Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Orders</strong> page
                </List.Item>
                <List.Item>
                  Select a <strong>Store</strong> and a <strong>Google Sheet</strong> + tab to sync to
                </List.Item>
                <List.Item>
                  Click <strong>"Setup Sync"</strong> to create the configuration
                </List.Item>
                <List.Item>
                  Click <strong>"Auto-Register Webhook"</strong> for real-time sync (recommended)
                </List.Item>
                <List.Item>
                  Or use <strong>"Manual Sync Now"</strong> to pull orders on demand
                </List.Item>
              </List>

              <Divider />
              <Text variant="bodySm" as="p" fontWeight="semibold">Data exported to sheets:</Text>
              <InlineStack gap="400" wrap>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p" fontWeight="semibold">Order Info</Text>
                  <List type="bullet">
                    <List.Item>Order Number, ID, Date</List.Item>
                    <List.Item>Status, Fulfillment Status</List.Item>
                    <List.Item>Total Price, Currency</List.Item>
                    <List.Item>Payment Method</List.Item>
                  </List>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p" fontWeight="semibold">Customer Info</Text>
                  <List type="bullet">
                    <List.Item>Customer ID, Email, Phone</List.Item>
                    <List.Item>First Name, Last Name</List.Item>
                    <List.Item>Shipping & Billing Address</List.Item>
                  </List>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p" fontWeight="semibold">Items & Tracking</Text>
                  <List type="bullet">
                    <List.Item>Line Items (name x qty)</List.Item>
                    <List.Item>Tracking Numbers & URLs</List.Item>
                    <List.Item>Notes, Tags</List.Item>
                  </List>
                </BlockStack>
              </InlineStack>

              <Divider />
              <Banner tone="warning">
                <p>
                  <strong>Important:</strong> You need to complete Step 1 (Stores) and Step 2 (Sheets)
                  before setting up order sync. Each store can have one active sync configuration.
                </p>
              </Banner>

              {syncConfigs.length > 0 && (
                <>
                  <Divider />
                  <Text variant="bodySm" as="p" fontWeight="semibold">Your sync configs:</Text>
                  <BlockStack gap="200">
                    {syncConfigs.map(config => (
                      <Box key={config.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                        <InlineStack align="space-between" blockAlign="center" wrap={false}>
                          <BlockStack gap="050">
                            <Text variant="bodySm" as="p" fontWeight="semibold">
                              {config.storeName || 'Store'} → {config.sheetName || 'Sheet'} / {config.targetSheet || 'Tab'}
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              {config.totalOrdersSynced || 0} orders synced
                              {config.lastSyncAt && ` · Last: ${new Date(config.lastSyncAt).toLocaleString()}`}
                            </Text>
                          </BlockStack>
                          <Badge tone={config.status === 'active' ? 'success' : 'info'}>
                            {config.status}
                          </Badge>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </GuideCard>
        </Layout.Section>

        {/* Step 4: Product Import */}
        <Layout.Section>
          <GuideCard
            step={4}
            title="Import Products"
            description="Import products from CSV files into your Shopify stores via an async queue."
            icon={ProductIcon}
            color="#47c1bf"
            done={null}
            pendingText="Go to Products to start importing"
            open={openGuide === 'products'}
            onToggle={() => toggleGuide('products')}
            actionLabel="Go to Products"
            actionUrl="/products"
          >
            <BlockStack gap="300">
              <Text variant="bodySm" as="p" fontWeight="semibold">How to import products:</Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Products</strong> page
                </List.Item>
                <List.Item>
                  Select the target <strong>Store(s)</strong> to import to
                </List.Item>
                <List.Item>
                  Upload a <strong>CSV file</strong> with your product data (or download the template first)
                </List.Item>
                <List.Item>
                  Products are queued and processed asynchronously — you can track progress in real-time
                </List.Item>
                <List.Item>
                  Check <strong>Import History</strong> tab for past imports and their results
                </List.Item>
              </List>

              <Divider />
              <Text variant="bodySm" as="p" fontWeight="semibold">CSV template columns:</Text>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="p">
                  <code>Title, Body HTML, Vendor, Product Type, Tags, Published, Option1 Name, Option1 Value, Variant SKU, Variant Price, Variant Compare At Price, Variant Inventory Qty, Image Src</code>
                </Text>
              </Box>

              <Banner tone="info">
                <p>
                  Products can be imported to multiple stores at once. The import uses a background queue
                  (Pub/Sub) so large imports won't time out.
                </p>
              </Banner>
            </BlockStack>
          </GuideCard>
        </Layout.Section>

        {/* Step 5: Tracking */}
        <Layout.Section>
          <GuideCard
            step={5}
            title="Update Tracking"
            description="Upload Excel files with tracking numbers to update fulfillment info on Shopify orders."
            icon={DeliveryIcon}
            color="#f49342"
            done={null}
            pendingText="Go to Tracking to start updating"
            open={openGuide === 'tracking'}
            onToggle={() => toggleGuide('tracking')}
            actionLabel="Go to Tracking"
            actionUrl="/tracking"
          >
            <BlockStack gap="300">
              <Text variant="bodySm" as="p" fontWeight="semibold">How to update tracking:</Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Tracking</strong> page
                </List.Item>
                <List.Item>
                  Select the <strong>Store</strong> to update tracking for
                </List.Item>
                <List.Item>
                  Upload an <strong>Excel file</strong> with tracking data (or download the template)
                </List.Item>
                <List.Item>
                  The system will match orders by order number and update fulfillment tracking
                </List.Item>
                <List.Item>
                  View detailed results: success/failure per order with error descriptions
                </List.Item>
              </List>

              <Divider />
              <Text variant="bodySm" as="p" fontWeight="semibold">Excel template columns:</Text>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" as="p">
                  <code>Order Number, Tracking Number, Carrier (optional), Tracking URL (optional)</code>
                </Text>
              </Box>

              <Banner tone="info">
                <p>
                  Tracking updates are processed asynchronously. You'll see a progress bar and can view
                  per-order results including any errors with helpful context messages.
                </p>
              </Banner>
            </BlockStack>
          </GuideCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

/* ---- Sub-components ---- */

function StatCard({title, value, icon, color, done, label}) {
  return (
    <div style={{flex: 1}}>
      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodySm" as="p" tone="subdued">{title}</Text>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon source={icon} tone="base" />
            </div>
          </InlineStack>
          <Text variant="heading2xl" as="p">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          <InlineStack gap="200" blockAlign="center">
            {done !== null && done !== undefined && (
              <Icon source={done ? CheckCircleIcon : AlertCircleIcon} tone={done ? 'success' : 'caution'} />
            )}
            <Text variant="bodySm" as="p" tone={done ? 'success' : 'subdued'}>
              {label || (done ? 'Configured' : 'Not configured')}
            </Text>
          </InlineStack>
        </BlockStack>
      </Card>
    </div>
  );
}

function GuideCard({step, title, description, icon, color, done, doneText, pendingText, open, onToggle, actionLabel, actionUrl, children}) {
  return (
    <Card>
      <BlockStack gap="300">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Icon source={icon} tone="base" />
            </div>
            <BlockStack gap="050">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingSm" as="h3">
                  Step {step}: {title}
                </Text>
                {done === true && <Badge tone="success">{doneText}</Badge>}
                {done === false && <Badge tone="attention">{pendingText}</Badge>}
                {done === null && <Badge>{pendingText}</Badge>}
              </InlineStack>
              <Text variant="bodySm" as="p" tone="subdued">{description}</Text>
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200">
            <Button url={actionUrl} size="slim">{actionLabel}</Button>
            <Button
              onClick={onToggle}
              icon={open ? ChevronUpIcon : ChevronDownIcon}
              variant="plain"
              accessibilityLabel={open ? 'Collapse guide' : 'Expand guide'}
            />
          </InlineStack>
        </InlineStack>

        {/* Collapsible Guide */}
        <Collapsible open={open} transition={{duration: '200ms', timingFunction: 'ease-in-out'}}>
          <Box paddingBlockStart="200" paddingInlineStart="1200">
            {children}
          </Box>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
