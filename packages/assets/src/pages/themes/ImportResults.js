import React from 'react';
import {Card, BlockStack, Text, InlineStack, Badge} from '@shopify/polaris';

export default function ImportResults({importResults}) {
  if (importResults.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Import Results
        </Text>
        {importResults.map((result, i) => (
          <InlineStack key={i} gap="200" blockAlign="center">
            <Badge tone={result.success ? 'success' : 'critical'}>
              {result.success ? 'OK' : 'Failed'}
            </Badge>
            <Text variant="bodyMd" fontWeight="semibold">
              {result.storeName}
            </Text>
            <Text tone="subdued" variant="bodySm">
              {result.message}
            </Text>
          </InlineStack>
        ))}
      </BlockStack>
    </Card>
  );
}
