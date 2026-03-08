import React from 'react';
import {BlockStack, Text, List, Banner} from '@shopify/polaris';

export default function SheetsGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to connect Google Sheets:
      </Text>
      <List type="number">
        <List.Item>Go to <strong>Google Sheets</strong> page</List.Item>
        <List.Item>Click <strong>&quot;Connect Google Account&quot;</strong> and authorize access</List.Item>
        <List.Item>Click <strong>&quot;Add Sheet&quot;</strong> and select a spreadsheet via Google Picker</List.Item>
        <List.Item>The sheet will appear in your connected sheets list</List.Item>
      </List>
      <Banner tone="info">
        <p>
          You can connect <strong>multiple Google accounts</strong> and add sheets from each.
          Sheets are used as the destination for order exports and the source for product/tracking imports.
        </p>
      </Banner>
    </BlockStack>
  );
}
