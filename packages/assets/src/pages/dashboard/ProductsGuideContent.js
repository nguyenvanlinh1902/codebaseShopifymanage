import React from 'react';
import {BlockStack, InlineStack, Text, List, Divider, Banner, Box} from '@shopify/polaris';

const CSV_COLUMNS = [
  {name: 'Title', required: true, example: 'Classic T-Shirt'},
  {name: 'Body HTML', required: false, example: '<p>Product description</p>'},
  {name: 'Vendor', required: false, example: 'My Brand'},
  {name: 'Product Type', required: false, example: 'Apparel'},
  {name: 'Tags', required: false, example: 'summer, sale'},
  {name: 'Published', required: false, example: 'true'},
  {name: 'Option1 Name', required: false, example: 'Size'},
  {name: 'Option1 Value', required: false, example: 'M'},
  {name: 'Variant SKU', required: false, example: 'SKU-001'},
  {name: 'Variant Price', required: true, example: '29.99'},
  {name: 'Variant Compare At Price', required: false, example: '39.99'},
  {name: 'Variant Inventory Qty', required: false, example: '100'},
  {name: 'Image Src', required: false, example: 'https://...'},
];

export default function ProductsGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to import products:
      </Text>
      <List type="number">
        <List.Item>Go to <strong>Products</strong> page, click <strong>&quot;Import CSV&quot;</strong></List.Item>
        <List.Item>Select one or more <strong>target stores</strong> to import to</List.Item>
        <List.Item>
          Upload a <strong>CSV file</strong> with product data, or click <strong>&quot;Download Template&quot;</strong> first
        </List.Item>
        <List.Item>Products are queued and processed in the background — track progress in real time</List.Item>
        <List.Item>Switch to <strong>Import History</strong> tab for past imports and results</List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        CSV columns:
      </Text>
      <BlockStack gap="150">
        {CSV_COLUMNS.map(col => (
          <Box key={col.name} padding="200" background="bg-surface-secondary" borderRadius="200">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodySm" as="span" fontWeight="semibold">
                  {col.name}
                </Text>
                {col.required && (
                  <Text variant="bodySm" as="span" tone="critical">*</Text>
                )}
              </InlineStack>
              <Text variant="bodySm" as="span" tone="subdued">
                e.g. {col.example}
              </Text>
            </InlineStack>
          </Box>
        ))}
        <Text variant="bodySm" as="p" tone="subdued">* Required fields</Text>
      </BlockStack>

      <Banner tone="info">
        <p>
          Products can be imported to <strong>multiple stores at once</strong>. Large imports use a background queue
          so they won&apos;t time out. Filter by store to see store-specific history.
        </p>
      </Banner>
    </BlockStack>
  );
}
