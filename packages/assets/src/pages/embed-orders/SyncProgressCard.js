import React from 'react';
import {Card, InlineStack, BlockStack, Text, Spinner} from '@shopify/polaris';

/**
 * Displays the current sync progress with job details
 */
export default function SyncProgressCard({syncJob}) {
  if (!syncJob || syncJob.status !== 'processing') {
    return null;
  }

  return (
    <Card>
      <InlineStack gap="400" blockAlign="center">
        <Spinner size="small" />
        <BlockStack gap="050">
          <Text variant="headingSm" as="h3" fontWeight="semibold">
            Syncing orders...
          </Text>
          <Text variant="bodySm" tone="subdued">
            {syncJob.successCount || 0} orders synced
            {syncJob.currentPage ? ` (page ${syncJob.currentPage})` : ''}
          </Text>
        </BlockStack>
      </InlineStack>
    </Card>
  );
}
