import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
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
  InlineGrid,
  Box,
  Icon,
  SkeletonBodyText,
  SkeletonDisplayText,
  Banner,
  Divider,
  Collapsible,
  ProgressBar
} from '@shopify/polaris';
import {
  ProductIcon,
  OrderIcon,
  CheckCircleIcon,
  NoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ImportIcon,
  ArrowRightIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

function StatCard({title, value, icon, iconBg, status, statusTone, subtitle}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="bodySm" tone="subdued" fontWeight="medium">
            {title}
          </Text>
          <Box background={iconBg} borderRadius="300" padding="200">
            <Icon source={icon} tone="base" />
          </Box>
        </InlineStack>
        <Text variant="headingXl" as="p" fontWeight="bold">
          {value}
        </Text>
        {status && (
          <InlineStack gap="150" blockAlign="center">
            <Badge tone={statusTone} size="small">
              {status}
            </Badge>
            {subtitle && (
              <Text variant="bodySm" tone="subdued">
                {subtitle}
              </Text>
            )}
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.func.isRequired,
  iconBg: PropTypes.string,
  status: PropTypes.string,
  statusTone: PropTypes.string,
  subtitle: PropTypes.string
};

function QuickStartTask({completed, label, description, selected, onSelect, buttons}) {
  return (
    <Box
      padding="300"
      borderRadius="200"
      background={selected ? 'bg-surface-secondary' : undefined}
    >
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <Box paddingBlockStart="050">
          {completed ? (
            <Icon source={CheckCircleIcon} tone="success" />
          ) : (
            <Box
              borderWidth="025"
              borderColor="border"
              borderRadius="full"
              minWidth="20px"
              minHeight="20px"
            />
          )}
        </Box>
        <Box width="100%">
          <BlockStack gap="100">
            <Box onClick={onSelect} role="button" style={{cursor: 'pointer'}}>
              <Text
                variant="bodyMd"
                fontWeight={selected ? 'semibold' : 'regular'}
                tone={completed ? 'subdued' : undefined}
              >
                {label}
              </Text>
            </Box>
            <Collapsible open={selected} transition={{duration: '200ms'}}>
              <BlockStack gap="300">
                <Text variant="bodySm" tone="subdued">
                  {description}
                </Text>
                <InlineStack gap="200">
                  {buttons.map(btn => (
                    <Button
                      key={btn.text}
                      onClick={btn.onClick}
                      variant={btn.variant || 'secondary'}
                      icon={btn.icon}
                      size="slim"
                    >
                      {btn.text}
                    </Button>
                  ))}
                </InlineStack>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Box>
      </InlineStack>
    </Box>
  );
}

QuickStartTask.propTypes = {
  completed: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  buttons: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      variant: PropTypes.string,
      icon: PropTypes.func
    })
  ).isRequired
};

export default function EmbedDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [productStats, setProductStats] = useState(null);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [error, setError] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  // QuickStart state
  const [quickStartOpen, setQuickStartOpen] = useState(true);
  const [quickStartDismissed, setQuickStartDismissed] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [storeRes, productRes, configRes, sheetsRes, googleRes] = await Promise.all([
        api('/api/embed/store'),
        api('/api/embed/products/queue-stats'),
        api('/api/embed/orders/sync-configs'),
        api('/api/embed/sheets'),
        api('/api/embed/google/status')
      ]);

      const [storeData, productData, configData, sheetsData, googleData] = await Promise.all([
        storeRes.json(),
        productRes.json(),
        configRes.json(),
        sheetsRes.json(),
        googleRes.json()
      ]);

      if (storeData.success) setStore(storeData.data);
      if (productData.success) setProductStats(productData.data);
      if (configData.success) setSyncConfigs(configData.data || []);
      if (sheetsData.success) setSheets(sheetsData.data || []);
      if (googleData.success) {
        setGoogleConnected(googleData.data?.connected || googleData.data?.authenticated || false);
      }
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

  // QuickStart tasks
  const tasks = [
    {
      id: 'google',
      label: 'Connect Google Account',
      description:
        'Link your Google account to enable syncing orders to Google Sheets. Only Sheets access is requested.',
      completed: googleConnected || sheets.length > 0,
      buttons: [
        {
          text: googleConnected ? 'Connected' : 'Go to Settings',
          onClick: () => navigate('/settings'),
          variant: 'primary',
          icon: ArrowRightIcon
        }
      ]
    },
    {
      id: 'sync',
      label: 'Setup Order Sync',
      description:
        'Select a Google Sheet and tab, then configure automatic or manual order syncing.',
      completed: !!activeSync,
      buttons: [
        {
          text: 'Go to Orders',
          onClick: () => navigate('/orders'),
          variant: 'primary',
          icon: ArrowRightIcon
        }
      ]
    },
    {
      id: 'products',
      label: 'Import Your First Products',
      description: 'Upload a CSV file to bulk import products into your Shopify store.',
      completed: (productStats?.completed || 0) > 0,
      buttons: [
        {
          text: 'Go to Products',
          onClick: () => navigate('/products'),
          variant: 'primary',
          icon: ImportIcon
        }
      ]
    }
  ];

  const completedCount = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const percentCompleted = Math.round((completedCount / totalTasks) * 100);

  // Auto-select first incomplete task
  useEffect(() => {
    if (!loading && selectedTask === null) {
      const firstIncomplete = tasks.find(t => !t.completed);
      setSelectedTask(firstIncomplete ? firstIncomplete.id : tasks[0].id);
    }
  }, [loading]);

  // Auto-dismiss QuickStart when all tasks are completed
  useEffect(() => {
    if (completedCount === totalTasks && !loading) {
      setQuickStartDismissed(true);
    }
  }, [completedCount, totalTasks, loading]);

  if (loading) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <InlineGrid columns={3} gap="400">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <SkeletonBodyText lines={3} />
                </Card>
              ))}
            </InlineGrid>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {/* Store Header */}
        {store && (
          <Card>
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="400" blockAlign="center">
                <Box background="bg-fill-success-secondary" borderRadius="300" padding="300">
                  <Text variant="headingLg" as="span">
                    {(store.name || store.shopDomain || '?').charAt(0).toUpperCase()}
                  </Text>
                </Box>
                <BlockStack gap="050">
                  <Text variant="headingMd" as="h2" fontWeight="bold">
                    {store.name || store.shopDomain}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {store.shopDomain}.myshopify.com
                    {store.plan && ` \u00B7 ${store.plan}`}
                  </Text>
                </BlockStack>
              </InlineStack>
              <Badge tone="success">Connected</Badge>
            </InlineStack>
          </Card>
        )}

        {/* Stats Grid */}
        <InlineGrid columns={3} gap="400">
          <StatCard
            title="Products Imported"
            value={productStats ? (productStats.completed || 0).toLocaleString() : '0'}
            icon={ProductIcon}
            iconBg="bg-fill-info-secondary"
            status={
              productStats?.pending > 0
                ? `${productStats.pending} pending`
                : productStats?.failed > 0
                ? `${productStats.failed} failed`
                : null
            }
            statusTone={productStats?.failed > 0 ? 'critical' : 'attention'}
          />
          <StatCard
            title="Orders Synced"
            value={totalSynced.toLocaleString()}
            icon={OrderIcon}
            iconBg="bg-fill-success-secondary"
            status={activeSync ? 'Sync Active' : 'Not configured'}
            statusTone={activeSync ? 'success' : 'new'}
          />
          <StatCard
            title="Google Sheets"
            value={String(sheets.length)}
            icon={NoteIcon}
            iconBg="bg-fill-caution-secondary"
            status={sheets.length > 0 ? 'Connected' : 'Not connected'}
            statusTone={sheets.length > 0 ? 'success' : 'new'}
          />
        </InlineGrid>

        {/* Active Sync Info */}
        {activeSync && (
          <Card>
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="400" blockAlign="center">
                <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                  <Icon source={CheckCircleIcon} tone="success" />
                </Box>
                <BlockStack gap="050">
                  <Text variant="headingSm" as="h3" fontWeight="semibold">
                    Active Sync
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {activeSync.sheetName || 'Sheet'} / {activeSync.targetSheet || 'Tab'}
                    {' \u00B7 '}
                    {activeSync.totalOrdersSynced || 0} orders synced
                    {activeSync.lastSyncAt &&
                      ` \u00B7 Last: ${new Date(activeSync.lastSyncAt).toLocaleDateString()}`}
                  </Text>
                </BlockStack>
              </InlineStack>
              <Button onClick={() => navigate('/orders')} variant="plain">
                Manage
              </Button>
            </InlineStack>
          </Card>
        )}

        {/* QuickStart */}
        {!quickStartDismissed && (
          <Card padding="0">
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h3">
                  Quick Start
                </Text>
                <InlineStack gap="100" blockAlign="center">
                  <Button
                    variant="plain"
                    onClick={() => setQuickStartOpen(prev => !prev)}
                    icon={quickStartOpen ? ChevronUpIcon : ChevronDownIcon}
                  />
                </InlineStack>
              </InlineStack>
            </Box>
            <Divider />
            <Box padding="400">
              <InlineGrid columns="auto 1fr" alignItems="center" gap="300">
                <Text variant="bodySm" tone="subdued">
                  {completedCount} of {totalTasks} tasks completed
                </Text>
                <ProgressBar progress={percentCompleted} size="small" tone="primary" />
              </InlineGrid>
            </Box>
            <Collapsible
              open={quickStartOpen}
              transition={{duration: '200ms', timingFunction: 'ease-in-out'}}
            >
              <Box paddingInline="200" paddingBlockEnd="200">
                <BlockStack gap="100">
                  {tasks.map(task => (
                    <QuickStartTask
                      key={task.id}
                      completed={task.completed}
                      label={task.label}
                      description={task.description}
                      selected={selectedTask === task.id}
                      onSelect={() => setSelectedTask(task.id)}
                      buttons={task.buttons}
                    />
                  ))}
                </BlockStack>
              </Box>
            </Collapsible>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
