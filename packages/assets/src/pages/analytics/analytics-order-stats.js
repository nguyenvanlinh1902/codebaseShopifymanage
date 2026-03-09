import React from 'react';
import {BlockStack, InlineStack, Text, Badge, SkeletonBodyText} from '@shopify/polaris';
import {OrderIcon, CashDollarIcon, ChartVerticalFilledIcon} from '@shopify/polaris-icons';
import AnalyticsStatCard from './analytics-stat-card';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(value || 0);
}

const STATUS_CONFIG = {
  fulfilled: {label: 'Fulfilled', tone: 'success'},
  unfulfilled: {label: 'Unfulfilled', tone: 'attention'},
  partial: {label: 'Partial', tone: 'info'},
  partially_fulfilled: {label: 'Partially Fulfilled', tone: 'info'},
  restocked: {label: 'Restocked', tone: 'warning'},
  unknown: {label: 'Unknown', tone: 'new'}
};

export default function AnalyticsOrderStats({summary, byStatus, loading}) {
  if (loading) return <SkeletonBodyText lines={6} />;

  if (!summary) {
    return <Text tone="subdued">No order data available for this store</Text>;
  }

  return (
    <BlockStack gap="400">
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
        <AnalyticsStatCard title="Total Orders" value={summary.totalOrders || 0} icon={OrderIcon} color="#6366f1" />
        <AnalyticsStatCard title="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={CashDollarIcon} color="#22c55e" />
        <AnalyticsStatCard title="Avg Order Value" value={formatCurrency(summary.avgOrderValue)} icon={ChartVerticalFilledIcon} color="#f59e0b" />
      </div>

      {byStatus && Object.keys(byStatus).length > 0 && (
        <BlockStack gap="200">
          <Text variant="headingSm">Orders by Fulfillment Status</Text>
          <InlineStack gap="200" wrap>
            {Object.entries(byStatus).map(([status, count]) => {
              const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
              return (
                <Badge key={status} tone={config.tone}>
                  {config.label}: {count}
                </Badge>
              );
            })}
          </InlineStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
