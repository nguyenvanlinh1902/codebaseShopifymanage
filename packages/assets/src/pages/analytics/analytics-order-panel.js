import React from 'react';
import {BlockStack, InlineStack, Text, DataTable, ProgressBar, SkeletonBodyText} from '@shopify/polaris';
import {OrderIcon, CheckIcon, XIcon, ClockIcon} from '@shopify/polaris-icons';
import PropTypes from 'prop-types';
import AnalyticsStatCard from './analytics-stat-card';

export default function AnalyticsOrderPanel({orderSummary, orderTrend, loading}) {
  if (loading) return <SkeletonBodyText lines={8} />;

  if (!orderSummary) {
    return <Text tone="subdued">No order data available for this store</Text>;
  }

  const total = orderSummary.total || 0;
  const pct = val => total > 0 ? Math.round((val / total) * 100) : 0;

  const trendRows = (orderTrend || []).map(t => [t.date, t.count]);

  return (
    <BlockStack gap="400">
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
        <AnalyticsStatCard title="Total Orders" value={total} icon={OrderIcon} color="#6366f1" />
        <AnalyticsStatCard title="Synced" value={orderSummary.synced || 0} icon={CheckIcon} color="#22c55e" subtitle={`${pct(orderSummary.synced)}%`} />
        <AnalyticsStatCard title="Failed" value={orderSummary.failed || 0} icon={XIcon} color="#ef4444" subtitle={`${pct(orderSummary.failed)}%`} />
        <AnalyticsStatCard title="Pending" value={orderSummary.pending || 0} icon={ClockIcon} color="#f59e0b" subtitle={`${pct(orderSummary.pending)}%`} />
      </div>

      <BlockStack gap="300">
        <Text variant="headingSm">Status Breakdown</Text>
        {[
          {label: 'Synced', val: orderSummary.synced || 0, tone: 'success'},
          {label: 'Failed', val: orderSummary.failed || 0, tone: 'critical'},
          {label: 'Pending', val: orderSummary.pending || 0, tone: 'highlight'}
        ].map(({label, val, tone}) => (
          <div key={label}>
            <InlineStack align="space-between">
              <Text variant="bodySm">{label}</Text>
              <Text variant="bodySm" fontWeight="semibold">{val}</Text>
            </InlineStack>
            <div style={{marginTop: '4px'}}>
              <ProgressBar progress={total > 0 ? (val / total) * 100 : 0} tone={tone} size="small" />
            </div>
          </div>
        ))}
      </BlockStack>

      {trendRows.length > 0 && (
        <BlockStack gap="200">
          <Text variant="headingSm">Orders by Date (Last 30 Days)</Text>
          <DataTable
            columnContentTypes={['text', 'numeric']}
            headings={['Date', 'Orders']}
            rows={trendRows}
          />
        </BlockStack>
      )}
    </BlockStack>
  );
}

AnalyticsOrderPanel.propTypes = {
  orderSummary: PropTypes.shape({
    total: PropTypes.number,
    synced: PropTypes.number,
    failed: PropTypes.number,
    pending: PropTypes.number
  }),
  orderTrend: PropTypes.arrayOf(PropTypes.shape({date: PropTypes.string, count: PropTypes.number})),
  loading: PropTypes.bool
};
