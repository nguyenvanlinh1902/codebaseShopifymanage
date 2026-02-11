import React from 'react';
import {Card, BlockStack, Text, DataTable, Badge} from '@shopify/polaris';

/**
 * Displays sync history table with configuration details
 */
export default function SyncHistoryTable({syncConfigs}) {
  if (!syncConfigs || syncConfigs.length === 0) {
    return null;
  }

  const configRows = syncConfigs.map(config => [
    config.sheetName || 'N/A',
    config.targetSheet || 'N/A',
    <Badge key={`status-${config.id}`} tone={config.status === 'active' ? 'success' : 'info'}>
      {config.status}
    </Badge>,
    config.totalOrdersSynced || 0,
    config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never'
  ]);

  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingMd" as="h2">
          Sync History
        </Text>
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
          headings={['Sheet', 'Target Tab', 'Status', 'Orders Synced', 'Last Sync']}
          rows={configRows}
        />
      </BlockStack>
    </Card>
  );
}
