import React from 'react';
import {Text, SkeletonBodyText, Card, BlockStack} from '@shopify/polaris';
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend} from 'recharts';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

export default function AnalyticsOrderChart({timeSeries, loading}) {
  if (loading) return <SkeletonBodyText lines={8} />;

  if (!timeSeries || timeSeries.length === 0) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text variant="headingSm">Orders & Revenue Over Time</Text>
          <Text tone="subdued">No data available for this period</Text>
        </BlockStack>
      </Card>
    );
  }

  const chartData = timeSeries.map(d => ({
    ...d,
    dateLabel: formatDate(d.date)
  }));

  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingSm">Orders & Revenue Over Time</Text>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{top: 5, right: 20, left: 10, bottom: 5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{fontSize: 12}} stroke="#9ca3af" />
            <YAxis yAxisId="left" tick={{fontSize: 12}} stroke="#6366f1" />
            <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} stroke="#22c55e" tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                return [value, 'Orders'];
              }}
              labelFormatter={label => label}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2} dot={false} name="Orders" />
            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </BlockStack>
    </Card>
  );
}
