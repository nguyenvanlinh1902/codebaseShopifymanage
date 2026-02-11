import React from 'react';
import {Card, Text, DataTable, Badge, ProgressBar, Button} from '@shopify/polaris';

/**
 * Import History Table Component
 * Displays import job history with status, progress, and actions
 */
export default function ImportHistoryTable({importHistory, onViewDetails}) {
  const importRows = importHistory.map(imp => [
    imp.fileName || 'N/A',
    imp.storeName || 'N/A',
    <Badge
      key={`status-${imp.id}`}
      tone={
        imp.status === 'completed'
          ? 'success'
          : imp.status === 'failed'
          ? 'critical'
          : imp.status === 'processing'
          ? 'info'
          : 'attention'
      }
    >
      {imp.status || 'pending'}
    </Badge>,
    imp.status === 'processing' ? (
      <div key={`progress-${imp.id}`} style={{width: '100px'}}>
        <ProgressBar
          progress={((imp.processedRecords || 0) / (imp.totalRecords || 1)) * 100}
          size="small"
        />
        <Text variant="bodySm" as="span" tone="subdued">
          {imp.processedRecords || 0}/{imp.totalRecords || 0}
        </Text>
      </div>
    ) : (
      `${imp.processedRecords || 0}/${imp.totalRecords || 0}`
    ),
    imp.status === 'completed' ? (
      <div key={`results-${imp.id}`}>
        <Text variant="bodySm" as="span" tone="success">
          {imp.successCount || 0} ok
        </Text>
        {' / '}
        <Text variant="bodySm" as="span" tone="critical">
          {imp.failedCount || 0} fail
        </Text>
      </div>
    ) : (
      '-'
    ),
    new Date(imp.createdAt).toLocaleString(),
    <Button key={`btn-${imp.id}`} size="slim" onClick={() => onViewDetails(imp)}>
      View Details
    </Button>
  ]);

  return (
    <Card>
      <div style={{padding: '16px'}}>
        <Text variant="headingMd" as="h2">
          Import History
        </Text>
      </div>

      {importHistory.length === 0 ? (
        <div style={{padding: '40px', textAlign: 'center'}}>
          <Text variant="bodySm" as="p" tone="subdued">
            No import history yet. Import your first tracking data to get started!
          </Text>
        </div>
      ) : (
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
          headings={['Source', 'Store', 'Status', 'Progress', 'Results', 'Created At', 'Actions']}
          rows={importRows}
        />
      )}
    </Card>
  );
}
