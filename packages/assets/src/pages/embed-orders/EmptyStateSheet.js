import React from 'react';
import {EmptyState, BlockStack, InlineStack, Text, Button, Badge} from '@shopify/polaris';

/**
 * Empty state component when no sheets are connected
 */
export default function EmptyStateSheet({onAddSheet, addingSheet}) {
  return (
    <EmptyState
      heading="Connect Google Sheets"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <BlockStack gap="400">
        <Text variant="bodyMd" as="p" tone="subdued">
          Connect your Google account and select a spreadsheet to start syncing orders.
        </Text>
        <Text variant="bodySm" as="p" tone="subdued">
          <Badge tone="info">Beta</Badge> Google Sheets integration is currently in beta.
        </Text>
        <InlineStack gap="200" align="center">
          <Button variant="primary" onClick={onAddSheet} loading={addingSheet}>
            Connect & Select Sheet
          </Button>
        </InlineStack>
      </BlockStack>
    </EmptyState>
  );
}
