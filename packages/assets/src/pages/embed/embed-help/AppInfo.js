import React from 'react';
import {Card, Text, BlockStack, InlineStack, Divider} from '@shopify/polaris';

export default function AppInfo() {
  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingSm" as="h3" fontWeight="semibold">
          App Information
        </Text>
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodySm" tone="subdued">
              App Name
            </Text>
            <Text variant="bodySm" fontWeight="medium">
              ToolTrackingOrder
            </Text>
          </InlineStack>
          <Divider />
          <InlineStack align="space-between">
            <Text variant="bodySm" tone="subdued">
              Version
            </Text>
            <Text variant="bodySm" fontWeight="medium">
              1.0.0
            </Text>
          </InlineStack>
          <Divider />
          <InlineStack align="space-between">
            <Text variant="bodySm" tone="subdued">
              API Version
            </Text>
            <Text variant="bodySm" fontWeight="medium">
              2026-01
            </Text>
          </InlineStack>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
