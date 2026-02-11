import React from 'react';
import {BlockStack, Text, List, Divider, Banner, Box} from '@shopify/polaris';

export default function ProductsGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to import products:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Products</strong> page, click <strong>"Import CSV"</strong>
        </List.Item>
        <List.Item>
          Select one or more <strong>target stores</strong> to import to
        </List.Item>
        <List.Item>
          Upload <strong>CSV file(s)</strong> with product data, or click{' '}
          <strong>"Download Template"</strong> first
        </List.Item>
        <List.Item>
          Products are queued and processed in the background — track real-time progress on the page
        </List.Item>
        <List.Item>
          Switch to <strong>Import History</strong> tab for past imports and results
        </List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Re-import existing products:
      </Text>
      <List type="number">
        <List.Item>
          In the <strong>Products</strong> tab, select products using the checkboxes
        </List.Item>
        <List.Item>
          Click <strong>"Re-import to Store"</strong> and choose target store(s)
        </List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        CSV template columns:
      </Text>
      <Box padding="200" background="bg-surface-secondary" borderRadius="200">
        <Text variant="bodySm" as="p">
          <code>
            Title, Body HTML, Vendor, Product Type, Tags, Published, Option1 Name, Option1 Value,
            Variant SKU, Variant Price, Variant Compare At Price, Variant Inventory Qty, Image Src
          </code>
        </Text>
      </Box>

      <Banner tone="info">
        <p>
          Products can be imported to multiple stores at once. The import uses a background queue
          so large imports won't time out. Filter by store to see store-specific history.
        </p>
      </Banner>
    </BlockStack>
  );
}
