import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  InlineGrid,
  SkeletonBodyText,
  Divider,
  Badge
} from '@shopify/polaris';

const STAT_CARDS = [
  {key: 'total', label: 'Total Trackings', tone: undefined},
  {key: 'in_transit', label: 'In Transit', tone: 'info'},
  {key: 'delivered', label: 'Delivered', tone: 'success'},
  {key: 'pending', label: 'Pending', tone: 'attention'},
  {key: 'not_found', label: 'Not Found', tone: 'warning'},
  {key: 'expired', label: 'Expired', tone: undefined},
  {key: 'alert', label: 'Alert', tone: 'critical'}
];

const KEY_STAT_CARDS = [
  {key: 'total', label: 'Total Keys'},
  {key: 'active', label: 'Active', tone: 'success'},
  {key: 'banned', label: 'Banned', tone: 'critical'},
  {key: 'quotaExceeded', label: 'Quota Exceeded', tone: 'warning'}
];

function StatCard({label, value, tone}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" tone="subdued">{label}</Text>
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" fontWeight="bold">{value ?? '—'}</Text>
          {tone && <Badge tone={tone}>{label}</Badge>}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export default function DashboardStatsTab({stats, loading, triggering, onTrigger, onRefresh}) {
  if (loading && !stats) {
    return (
      <Box padding="400">
        <BlockStack gap="400">
          <SkeletonBodyText lines={6} />
        </BlockStack>
      </Box>
    );
  }

  const statusStats = stats?.statuses || {};
  const keyStats = stats?.apiKeys || {};

  const quotaPercent = keyStats.totalQuotaTotal
    ? Math.round((keyStats.totalQuotaUsed / keyStats.totalQuotaTotal) * 100)
    : 0;

  return (
    <Box padding="400">
      <BlockStack gap="600">
        {/* Actions */}
        <InlineStack gap="300" align="end">
          <Button onClick={onRefresh} disabled={loading}>Refresh</Button>
          <Button variant="primary" onClick={onTrigger} loading={triggering}>
            Recheck Existing
          </Button>
        </InlineStack>

        {/* Tracking Status Stats */}
        <BlockStack gap="300">
          <Text variant="headingMd" fontWeight="semibold">Tracking Statuses</Text>
          <InlineGrid columns={{xs: 2, sm: 3, md: 4, lg: 4}} gap="300">
            {STAT_CARDS.map(({key, label, tone}) => (
              <StatCard key={key} label={label} value={statusStats[key]} tone={tone} />
            ))}
          </InlineGrid>
          <InlineStack gap="400">
            <Text variant="bodySm" tone="subdued">
              Registered: {statusStats.registered ?? 0}
            </Text>
            <Text variant="bodySm" tone="subdued">
              Unregistered: {statusStats.unregistered ?? 0}
            </Text>
          </InlineStack>
        </BlockStack>

        <Divider />

        {/* API Key Stats */}
        <BlockStack gap="300">
          <Text variant="headingMd" fontWeight="semibold">API Keys</Text>
          <InlineGrid columns={{xs: 2, sm: 4}} gap="300">
            {KEY_STAT_CARDS.map(({key, label, tone}) => (
              <StatCard key={key} label={label} value={keyStats[key]} tone={tone} />
            ))}
          </InlineGrid>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued">Quota Usage</Text>
                <Text variant="bodySm" fontWeight="semibold">{quotaPercent}%</Text>
              </InlineStack>
              <div style={{
                height: '8px',
                borderRadius: '4px',
                backgroundColor: 'var(--p-color-bg-surface-secondary)',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(quotaPercent, 100)}%`,
                  borderRadius: '4px',
                  backgroundColor: quotaPercent > 80
                    ? 'var(--p-color-bg-fill-critical)'
                    : quotaPercent > 50
                      ? 'var(--p-color-bg-fill-warning)'
                      : 'var(--p-color-bg-fill-success)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <Text variant="bodySm" tone="subdued">
                {keyStats.totalQuotaUsed ?? 0} / {keyStats.totalQuotaTotal ?? 0} registrations used
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </BlockStack>
    </Box>
  );
}
