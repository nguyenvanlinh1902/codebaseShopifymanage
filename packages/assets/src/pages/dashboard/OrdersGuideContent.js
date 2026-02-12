import React from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  List,
  Divider,
  Banner,
  Box,
  Badge
} from '@shopify/polaris';
import VideoDemo from './VideoDemo';

export default function OrdersGuideContent({syncConfigs}) {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to setup order sync:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Orders</strong> page
        </List.Item>
        <List.Item>
          Select a <strong>Store</strong> and a <strong>Google Sheet</strong> + tab to sync to
        </List.Item>
        <List.Item>
          Click <strong>"Setup Sync"</strong> to create the configuration
        </List.Item>
        <List.Item>
          Click <strong>"Auto-Register Webhook"</strong> for real-time sync (recommended)
        </List.Item>
        <List.Item>
          Or use <strong>"Manual Sync Now"</strong> to pull orders on demand
        </List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Data exported to sheets:
      </Text>
      <InlineStack gap="400" wrap>
        <BlockStack gap="100">
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Order Info
          </Text>
          <List type="bullet">
            <List.Item>Order Number, Email, Date</List.Item>
            <List.Item>Total, Tax, Base Cost, Fee</List.Item>
            <List.Item>Payment Method, Note</List.Item>
          </List>
        </BlockStack>
        <BlockStack gap="100">
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Product Info
          </Text>
          <List type="bullet">
            <List.Item>Product Name, SKU, Price</List.Item>
            <List.Item>Quantity, Size, Type</List.Item>
            <List.Item>Custom Name, Design</List.Item>
          </List>
        </BlockStack>
        <BlockStack gap="100">
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Shipping Info
          </Text>
          <List type="bullet">
            <List.Item>Shipping Name, Phone</List.Item>
            <List.Item>Address 1, Address 2</List.Item>
            <List.Item>City, State, Zip, Country</List.Item>
          </List>
        </BlockStack>
      </InlineStack>

      <Divider />
      <Banner tone="warning">
        <p>
          <strong>Important:</strong> You need to complete Step 1 (Stores) and Step 2 (Sheets)
          before setting up order sync. Each store can have one active sync configuration.
        </p>
      </Banner>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Video Demo:
      </Text>
      <VideoDemo src="https://cdn.shopify.com/videos/c/o/v/b5192267f0564e3bbde68dee7672d0ec.mov" />

      {syncConfigs.length > 0 && (
        <>
          <Divider />
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Your sync configs:
          </Text>
          <BlockStack gap="200">
            {syncConfigs.map(config => (
              <Box
                key={config.id}
                padding="200"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <BlockStack gap="050">
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      {config.storeName || 'Store'} → {config.sheetName || 'Sheet'} /{' '}
                      {config.targetSheet || 'Tab'}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {config.totalOrdersSynced || 0} orders synced
                      {config.lastSyncAt &&
                        ` · Last: ${new Date(config.lastSyncAt).toLocaleString()}`}
                    </Text>
                  </BlockStack>
                  <Badge tone={config.status === 'active' ? 'success' : 'info'}>
                    {config.status}
                  </Badge>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
