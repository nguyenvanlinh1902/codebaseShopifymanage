import React from 'react';
import {Card, BlockStack, Text, DataTable, Badge, SkeletonBodyText} from '@shopify/polaris';
import PaginationControls from '../../components/pagination-controls';

/**
 * Displays sync history table with configuration details
 */
export default function SyncHistoryTable({
  syncConfigs,
  loading,
  pagination,
  page,
  perPage,
  search,
  onPageChange,
  onPerPageChange,
  onSearchChange
}) {
  const totalItems = pagination?.total ?? (syncConfigs || []).length;

  if (!syncConfigs || totalItems === 0) {
    return null;
  }

  const configRows = (syncConfigs || []).map(config => [
    config.spreadsheetId ? (
      <a
        key={`link-${config.id}`}
        href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
        target="_blank"
        rel="noopener noreferrer"
        style={{textDecoration: 'none', color: '#2c6ecb'}}
      >
        {config.sheetName || 'N/A'}
      </a>
    ) : (
      config.sheetName || 'N/A'
    ),
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
        <PaginationControls
          page={page}
          totalPages={pagination?.totalPages || 1}
          totalItems={totalItems}
          perPage={perPage}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search by sheet, tab, or status..."
        />
        {loading ? (
          <SkeletonBodyText lines={3} />
        ) : (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
            headings={['Sheet', 'Target Tab', 'Status', 'Orders Synced', 'Last Sync']}
            rows={configRows}
          />
        )}
      </BlockStack>
    </Card>
  );
}
