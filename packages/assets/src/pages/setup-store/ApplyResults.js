import React from 'react';
import {Card, Text, Badge, InlineStack, BlockStack} from '@shopify/polaris';

export default function ApplyResults({applyResults}) {
  if (applyResults.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Setup Results
        </Text>
        {applyResults.map(storeResult => (
          <Card key={storeResult.storeId}>
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="bold">
                {storeResult.storeName}
                {storeResult.shopDomain && ` (${storeResult.shopDomain}.myshopify.com)`}
              </Text>
              {storeResult.created?.map((item, i) => (
                <InlineStack key={`c-${i}`} gap="200" blockAlign="center">
                  <Badge tone="success">Created</Badge>
                  <Text variant="bodySm">{item.name}</Text>
                </InlineStack>
              ))}
              {storeResult.skipped?.map((item, i) => (
                <InlineStack key={`s-${i}`} gap="200" blockAlign="center">
                  <Badge>Skipped</Badge>
                  <Text variant="bodySm">
                    {item.name} - {item.reason}
                  </Text>
                </InlineStack>
              ))}
              {storeResult.errors?.map((item, i) => (
                <InlineStack key={`e-${i}`} gap="200" blockAlign="center">
                  <Badge tone="critical">Error</Badge>
                  <Text variant="bodySm">
                    {item.name} - {item.error}
                  </Text>
                </InlineStack>
              ))}
              {storeResult.themeResult && (
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={storeResult.themeResult.success ? 'success' : 'critical'}>
                    {storeResult.themeResult.success ? 'Theme OK' : 'Theme Failed'}
                  </Badge>
                  <Text variant="bodySm">{storeResult.themeResult.message}</Text>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Card>
  );
}
