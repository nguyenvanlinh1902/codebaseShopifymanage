import React from 'react';
import {BlockStack, InlineStack, Text, List, Divider, Box, Badge, Banner} from '@shopify/polaris';

export default function StoresGuideContent({stores, hasStores}) {
  return (
    <BlockStack gap="300">
      <Banner tone="info">
        <p>
          Stores are <strong>auto-created</strong> when you install the app on a Shopify store via
          OAuth. No manual setup needed.
        </p>
      </Banner>

      <Text variant="bodySm" as="p" fontWeight="semibold">
        How stores are connected:
      </Text>
      <List type="number">
        <List.Item>
          Install the app on your Shopify store — the store is automatically registered
        </List.Item>
        <List.Item>
          Go to the <strong>Stores</strong> page to view and manage your connected stores
        </List.Item>
        <List.Item>
          You can update store details (name, niche) or remove stores from the Stores page
        </List.Item>
      </List>

      {hasStores && (
        <>
          <Divider />
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Your stores:
          </Text>
          <BlockStack gap="200">
            {stores.map(store => (
              <Box
                key={store.id}
                padding="200"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      {store.name}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {store.shopDomain}.myshopify.com
                    </Text>
                  </BlockStack>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
