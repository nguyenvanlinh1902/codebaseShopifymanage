import React from 'react';
import {Card, BlockStack, InlineStack, Text, Badge, Button, EmptyState} from '@shopify/polaris';
import {ViewIcon} from '@shopify/polaris-icons';

function formatTimestamp(ts) {
  if (!ts) return '-';
  return new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleString();
}

export default function ImportHistoryTab({importHistory, onViewDetails}) {
  if (importHistory.length === 0) {
    return (
      <Card>
        <EmptyState heading="No import history">
          <Text>Import products from CSV to see history here.</Text>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        {importHistory.map(imp => (
          <Card key={imp.id}>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodyMd" fontWeight="semibold">
                  {imp.fileName || 'Unknown file'}
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Badge
                    tone={
                      imp.status === 'completed'
                        ? 'success'
                        : imp.status === 'failed'
                        ? 'critical'
                        : imp.status === 'partial'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {imp.status}
                  </Badge>
                  <Button size="slim" icon={ViewIcon} onClick={() => onViewDetails(imp)}>
                    Details
                  </Button>
                </InlineStack>
              </InlineStack>

              <InlineStack gap="400">
                <Text variant="bodySm" tone="subdued">
                  {formatTimestamp(imp.createdAt)}
                </Text>
                {imp.totalProducts > 0 && (
                  <Text variant="bodySm" tone="subdued">
                    {imp.totalProducts} products
                  </Text>
                )}
                {(imp.successCount || 0) > 0 && (
                  <Text variant="bodySm" tone="success">
                    {imp.successCount} success
                  </Text>
                )}
                {(imp.failedCount || 0) > 0 && (
                  <Text variant="bodySm" tone="critical">
                    {imp.failedCount} failed
                  </Text>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Card>
  );
}
