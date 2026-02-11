import React from 'react';
import {BlockStack, Text, List, Divider, Banner} from '@shopify/polaris';

export default function SheetsGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to connect Google Sheets:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Google Sheets</strong> page
        </List.Item>
        <List.Item>
          Click <strong>"Connect Google Account"</strong> and authorize access
        </List.Item>
        <List.Item>
          Once connected, click <strong>"Add Sheet"</strong> and select a spreadsheet using the
          Google Picker
        </List.Item>
        <List.Item>The sheet will appear in your connected sheets list</List.Item>
      </List>

      <Divider />
      <Banner tone="info">
        <p>
          You can connect multiple Google accounts and add sheets from each. Sheets are used as the
          destination for order exports and the source for product/tracking imports.
        </p>
      </Banner>
    </BlockStack>
  );
}
