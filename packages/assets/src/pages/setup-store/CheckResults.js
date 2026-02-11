import React from 'react';
import {Card, Text, Badge, InlineStack, BlockStack} from '@shopify/polaris';

export default function CheckResults({checkResults}) {
  if (checkResults.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Check Results
        </Text>
        {checkResults.map(storeResult => (
          <Card key={storeResult.storeId}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodyMd" fontWeight="bold">
                  {storeResult.storeName}
                </Text>
                {storeResult.shopDomain && (
                  <Text tone="subdued" variant="bodySm">
                    ({storeResult.shopDomain}.myshopify.com)
                  </Text>
                )}
                {storeResult.error && <Badge tone="critical">Error: {storeResult.error}</Badge>}
              </InlineStack>
              {storeResult.metafields.map(mf => (
                <InlineStack key={`${mf.namespace}.${mf.key}`} gap="200" blockAlign="center">
                  <Badge
                    tone={
                      mf.status === 'exists'
                        ? 'success'
                        : mf.status === 'missing'
                        ? 'warning'
                        : 'critical'
                    }
                  >
                    {mf.status === 'exists' ? 'OK' : mf.status === 'missing' ? 'Missing' : 'Error'}
                  </Badge>
                  <Text variant="bodySm">
                    {mf.name} ({mf.namespace}.{mf.key})
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Card>
  );
}
