import React from 'react';
import {BlockStack, Text, Badge, DataTable, SkeletonBodyText} from '@shopify/polaris';
import PropTypes from 'prop-types';

const STATUS_TONES = {active: 'success', inactive: 'critical', error: 'warning'};

export default function AnalyticsSheetStatusPanel({sheetConfigs, loading}) {
  if (loading) return <SkeletonBodyText lines={4} />;

  const configs = sheetConfigs || [];
  if (configs.length === 0) {
    return <Text tone="subdued">No sheet configurations found for this store</Text>;
  }

  const rows = configs.map(c => [
    c.name || c.id,
    <Badge key={c.id} tone={STATUS_TONES[c.status] || 'new'}>{c.status || 'unknown'}</Badge>
  ]);

  return (
    <BlockStack gap="300">
      <Text variant="headingMd">Sheet Configurations</Text>
      <DataTable
        columnContentTypes={['text', 'text']}
        headings={['Name', 'Status']}
        rows={rows}
      />
    </BlockStack>
  );
}

AnalyticsSheetStatusPanel.propTypes = {
  sheetConfigs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    status: PropTypes.string
  })),
  loading: PropTypes.bool
};
