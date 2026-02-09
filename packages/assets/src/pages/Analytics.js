import React, {useState, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  SkeletonBodyText,
  DataTable,
  InlineStack,
  BlockStack,
  ProgressBar,
  Icon,
  Tabs
} from '@shopify/polaris';
import {
  OrderIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  DeliveryIcon,
  ProductIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

function StatCard({title, value, icon, color, subtitle}) {
  return (
    <div
      style={{
        padding: '20px',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
        border: `1px solid ${color}30`
      }}
    >
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text variant="bodySm" tone="subdued">
            {title}
          </Text>
          <Text variant="heading2xl" as="h3">
            {value}
          </Text>
          {subtitle && (
            <Text variant="bodySm" tone="subdued">
              {subtitle}
            </Text>
          )}
        </BlockStack>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon source={icon} tone="base" />
        </div>
      </InlineStack>
    </div>
  );
}

function StatusBadge({status}) {
  const map = {
    completed: {tone: 'success', label: 'Completed'},
    processing: {tone: 'attention', label: 'Processing'},
    failed: {tone: 'critical', label: 'Failed'},
    pending: {tone: 'info', label: 'Pending'}
  };
  const info = map[status] || {tone: 'new', label: status};
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api('/api/analytics/stats');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Page title="Analytics">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={8} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Analytics">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text tone="critical">Error: {error}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const {
    orderSummary,
    ordersByStore,
    orderTrend,
    productImportStats,
    trackingImportStats,
    recentTracking,
    recentProducts
  } = data;

  const tabs = [
    {id: 'orders', content: 'Orders Overview'},
    {id: 'tracking', content: 'Tracking Imports'},
    {id: 'products', content: 'Product Imports'}
  ];

  // Order status chart (simple bar)
  const maxOrderVal = Math.max(orderSummary.synced, orderSummary.failed, orderSummary.pending, 1);

  // Orders by store table
  const storeRows = ordersByStore.map(s => [
    s.storeName,
    s.shopDomain,
    s.total,
    s.syncedToSheet,
    s.failedToSync,
    s.total - s.syncedToSheet - s.failedToSync > 0 ? s.total - s.syncedToSheet - s.failedToSync : 0
  ]);

  // Order trend (last 30 days) - simple table
  const trendRows = orderTrend.map(t => [t.date, t.count]);

  // Tracking import rows
  const trackingRows = recentTracking.map(t => [
    t.storeName,
    t.fileName || '-',
    <StatusBadge key={t.id} status={t.status} />,
    t.totalRecords,
    t.successCount,
    t.failedCount,
    t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'
  ]);

  // Product import rows
  const productRows = recentProducts.map(p => [
    p.storeName,
    p.fileName || '-',
    <StatusBadge key={p.id} status={p.status} />,
    p.totalRecords,
    p.successCount,
    p.failedCount,
    p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'
  ]);

  return (
    <Page title="Analytics" subtitle="Order statistics and import processing overview">
      <Layout>
        {/* Order Summary Cards */}
        <Layout.Section>
          <Text variant="headingMd" as="h2">
            Order Summary
          </Text>
          <div style={{marginTop: '12px'}}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}
            >
              <StatCard
                title="Total Orders"
                value={orderSummary.total}
                icon={OrderIcon}
                color="#6366f1"
              />
              <StatCard
                title="Synced"
                value={orderSummary.synced}
                icon={CheckIcon}
                color="#22c55e"
                subtitle={
                  orderSummary.total > 0
                    ? `${Math.round((orderSummary.synced / orderSummary.total) * 100)}%`
                    : '0%'
                }
              />
              <StatCard
                title="Failed"
                value={orderSummary.failed}
                icon={XIcon}
                color="#ef4444"
                subtitle={
                  orderSummary.total > 0
                    ? `${Math.round((orderSummary.failed / orderSummary.total) * 100)}%`
                    : '0%'
                }
              />
              <StatCard
                title="Pending"
                value={orderSummary.pending}
                icon={ClockIcon}
                color="#f59e0b"
                subtitle={
                  orderSummary.total > 0
                    ? `${Math.round((orderSummary.pending / orderSummary.total) * 100)}%`
                    : '0%'
                }
              />
            </div>
          </div>
        </Layout.Section>

        {/* Order Status Bar Chart */}
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Order Status Breakdown
            </Text>
            <div style={{marginTop: '16px'}}>
              <BlockStack gap="300">
                <div>
                  <InlineStack align="space-between">
                    <Text variant="bodySm">Synced to Sheet</Text>
                    <Text variant="bodySm" fontWeight="semibold">
                      {orderSummary.synced}
                    </Text>
                  </InlineStack>
                  <div style={{marginTop: '4px'}}>
                    <ProgressBar
                      progress={
                        orderSummary.total > 0
                          ? (orderSummary.synced / orderSummary.total) * 100
                          : 0
                      }
                      tone="success"
                      size="small"
                    />
                  </div>
                </div>
                <div>
                  <InlineStack align="space-between">
                    <Text variant="bodySm">Failed</Text>
                    <Text variant="bodySm" fontWeight="semibold">
                      {orderSummary.failed}
                    </Text>
                  </InlineStack>
                  <div style={{marginTop: '4px'}}>
                    <ProgressBar
                      progress={
                        orderSummary.total > 0
                          ? (orderSummary.failed / orderSummary.total) * 100
                          : 0
                      }
                      tone="critical"
                      size="small"
                    />
                  </div>
                </div>
                <div>
                  <InlineStack align="space-between">
                    <Text variant="bodySm">Pending</Text>
                    <Text variant="bodySm" fontWeight="semibold">
                      {orderSummary.pending}
                    </Text>
                  </InlineStack>
                  <div style={{marginTop: '4px'}}>
                    <ProgressBar
                      progress={
                        orderSummary.total > 0
                          ? (orderSummary.pending / orderSummary.total) * 100
                          : 0
                      }
                      tone="highlight"
                      size="small"
                    />
                  </div>
                </div>
              </BlockStack>
            </div>
          </Card>
        </Layout.Section>

        {/* Import Summary Cards */}
        <Layout.Section>
          <Text variant="headingMd" as="h2">
            Import Processing Summary
          </Text>
          <div style={{marginTop: '12px'}}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}
            >
              <StatCard
                title="Tracking Imports"
                value={trackingImportStats.total}
                icon={DeliveryIcon}
                color="#8b5cf6"
                subtitle={`${trackingImportStats.totalUpdated} orders updated`}
              />
              <StatCard
                title="Tracking Success"
                value={trackingImportStats.completed}
                icon={CheckIcon}
                color="#22c55e"
                subtitle={`${trackingImportStats.failed} failed`}
              />
              <StatCard
                title="Product Imports"
                value={productImportStats.total}
                icon={ProductIcon}
                color="#3b82f6"
                subtitle={`${productImportStats.totalProducts} products imported`}
              />
              <StatCard
                title="Product Success"
                value={productImportStats.completed}
                icon={CheckIcon}
                color="#10b981"
                subtitle={`${productImportStats.failed} failed`}
              />
            </div>
          </div>
        </Layout.Section>

        {/* Tabs: Orders by Store / Tracking / Products */}
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <div style={{marginTop: '16px'}}>
                {selectedTab === 0 && (
                  <BlockStack gap="400">
                    {/* Orders by Store */}
                    <Text variant="headingSm" as="h3">
                      Orders by Store
                    </Text>
                    {storeRows.length > 0 ? (
                      <DataTable
                        columnContentTypes={[
                          'text',
                          'text',
                          'numeric',
                          'numeric',
                          'numeric',
                          'numeric'
                        ]}
                        headings={['Store', 'Domain', 'Total', 'Synced', 'Failed', 'Pending']}
                        rows={storeRows}
                        totals={[
                          '',
                          '',
                          orderSummary.total,
                          orderSummary.synced,
                          orderSummary.failed,
                          orderSummary.pending
                        ]}
                        showTotalsInFooter
                      />
                    ) : (
                      <Text tone="subdued">No store data available</Text>
                    )}

                    {/* Order Trend */}
                    {trendRows.length > 0 && (
                      <>
                        <Text variant="headingSm" as="h3">
                          Orders by Date (Last 30 Days)
                        </Text>
                        <DataTable
                          columnContentTypes={['text', 'numeric']}
                          headings={['Date', 'Orders']}
                          rows={trendRows}
                        />
                      </>
                    )}
                  </BlockStack>
                )}

                {selectedTab === 1 && (
                  <BlockStack gap="400">
                    <Text variant="headingSm" as="h3">
                      Recent Tracking Imports
                    </Text>
                    {/* Tracking Import Status Summary */}
                    <InlineStack gap="300" wrap>
                      <Badge tone="success">Completed: {trackingImportStats.completed}</Badge>
                      <Badge tone="attention">Processing: {trackingImportStats.processing}</Badge>
                      <Badge tone="critical">Failed: {trackingImportStats.failed}</Badge>
                      <Badge tone="info">Pending: {trackingImportStats.pending}</Badge>
                    </InlineStack>

                    {trackingRows.length > 0 ? (
                      <DataTable
                        columnContentTypes={[
                          'text',
                          'text',
                          'text',
                          'numeric',
                          'numeric',
                          'numeric',
                          'text'
                        ]}
                        headings={['Store', 'File', 'Status', 'Total', 'Success', 'Failed', 'Date']}
                        rows={trackingRows}
                      />
                    ) : (
                      <Text tone="subdued">No tracking imports yet</Text>
                    )}
                  </BlockStack>
                )}

                {selectedTab === 2 && (
                  <BlockStack gap="400">
                    <Text variant="headingSm" as="h3">
                      Recent Product Imports
                    </Text>
                    {/* Product Import Status Summary */}
                    <InlineStack gap="300" wrap>
                      <Badge tone="success">Completed: {productImportStats.completed}</Badge>
                      <Badge tone="attention">Processing: {productImportStats.processing}</Badge>
                      <Badge tone="critical">Failed: {productImportStats.failed}</Badge>
                      <Badge tone="info">Pending: {productImportStats.pending}</Badge>
                    </InlineStack>

                    {productRows.length > 0 ? (
                      <DataTable
                        columnContentTypes={[
                          'text',
                          'text',
                          'text',
                          'numeric',
                          'numeric',
                          'numeric',
                          'text'
                        ]}
                        headings={['Store', 'File', 'Status', 'Total', 'Success', 'Failed', 'Date']}
                        rows={productRows}
                      />
                    ) : (
                      <Text tone="subdued">No product imports yet</Text>
                    )}
                  </BlockStack>
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
