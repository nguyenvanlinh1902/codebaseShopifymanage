import React from 'react';
import {BlockStack, Text, List, Banner} from '@shopify/polaris';

export default function StoresGuideContent() {
  return (
    <BlockStack gap="300">
      <Banner tone="info">
        <p>
          Stores are <strong>auto-created</strong> when you install the app on a Shopify store via
          OAuth — no manual setup needed.
        </p>
      </Banner>
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How it works:
      </Text>
      <List type="number">
        <List.Item>Install this app on your Shopify store — it&apos;s automatically registered</List.Item>
        <List.Item>Go to <strong>Stores</strong> to view all connected stores</List.Item>
        <List.Item>Update store details (name, niche) or remove stores as needed</List.Item>
      </List>
    </BlockStack>
  );
}
