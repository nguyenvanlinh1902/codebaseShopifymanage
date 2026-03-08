import React from 'react';
import {Card, Text, Badge, ProgressBar, Button, BlockStack, InlineStack, Box, Divider} from '@shopify/polaris';
import {RefreshIcon} from '@shopify/polaris-icons';

const STATUS_TONE = {
  completed: 'success',
  failed: 'critical',
  processing: 'info',
  pending: 'attention'
};

function ImportRow({imp, onViewDetails}) {
  const progress = imp.totalRecords > 0 ? (imp.processedRecords / imp.totalRecords) * 100 : 0;
  const isProcessing = imp.status === 'processing' || imp.status === 'pending';
  const date = new Date(imp.createdAt);

  return (
    <Box padding="400">
      <InlineStack align="space-between" blockAlign="start" wrap={false}>
        <BlockStack gap="150">
          {/* Source file / sheet name */}
          <InlineStack gap="200" blockAlign="center">
            <Text variant="bodyMd" fontWeight="semibold">{imp.fileName || 'N/A'}</Text>
            <Badge tone={STATUS_TONE[imp.status] || 'attention'}>
              {imp.status || 'pending'}
            </Badge>
          </InlineStack>

          {/* Store + date */}
          <InlineStack gap="300">
            {imp.storeName && (
              <Text tone="subdued" variant="bodySm">{imp.storeName}</Text>
            )}
            <Text tone="subdued" variant="bodySm">
              {date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
              {' · '}
              {date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}
            </Text>
          </InlineStack>

          {/* Progress bar while processing */}
          {isProcessing && imp.totalRecords > 0 && (
            <BlockStack gap="100">
              <div style={{width: '200px'}}>
                <ProgressBar progress={progress} size="small" tone="highlight" />
              </div>
              <Text tone="subdued" variant="bodySm">
                {imp.processedRecords || 0} / {imp.totalRecords} records
              </Text>
            </BlockStack>
          )}

          {/* Results when completed */}
          {imp.status === 'completed' && (
            <InlineStack gap="200">
              <Badge tone="success">{imp.successCount || 0} ok</Badge>
              {(imp.failedCount || 0) > 0 && (
                <Badge tone="critical">{imp.failedCount} failed</Badge>
              )}
              <Text tone="subdued" variant="bodySm">
                {imp.totalRecords || 0} total
              </Text>
            </InlineStack>
          )}
        </BlockStack>

        <Button size="slim" onClick={() => onViewDetails(imp)}>
          Details
        </Button>
      </InlineStack>
    </Box>
  );
}

export default function ImportHistoryTable({importHistory, onViewDetails, onRefresh}) {
  return (
    <Card padding="0">
      <Box padding="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">Import History</Text>
            {importHistory.length > 0 && (
              <Text tone="subdued" variant="bodySm">{importHistory.length} job{importHistory.length !== 1 ? 's' : ''}</Text>
            )}
          </BlockStack>
          <Button icon={RefreshIcon} size="slim" onClick={onRefresh}>Refresh</Button>
        </InlineStack>
      </Box>

      {importHistory.length === 0 ? (
        <Box padding="1000">
          <Text tone="subdued" alignment="center" variant="bodySm">
            No import history yet — import your first tracking data to get started
          </Text>
        </Box>
      ) : (
        <BlockStack>
          {importHistory.map((imp, i) => (
            <React.Fragment key={imp.id}>
              {i > 0 && <Divider />}
              <ImportRow imp={imp} onViewDetails={onViewDetails} />
            </React.Fragment>
          ))}
        </BlockStack>
      )}
    </Card>
  );
}
