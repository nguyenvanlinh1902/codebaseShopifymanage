import React from 'react';
import {BlockStack, Text, List, Divider, Banner, Box} from '@shopify/polaris';
import VideoDemo from './VideoDemo';

export default function ProductsGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to import products:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Products</strong> page
        </List.Item>
        <List.Item>
          Select the target <strong>Store(s)</strong> to import to
        </List.Item>
        <List.Item>
          Upload a <strong>CSV file</strong> with your product data (or download the template
          first)
        </List.Item>
        <List.Item>
          Products are queued and processed asynchronously — you can track progress in real-time
        </List.Item>
        <List.Item>
          Check <strong>Import History</strong> tab for past imports and their results
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
          (Pub/Sub) so large imports won't time out.
        </p>
      </Banner>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Video Demo:
      </Text>
      <VideoDemo src="https://cdn.shopify.com/videos/c/o/v/1b67afc033314d00b134c6b984f83d7d.mov" />
    </BlockStack>
  );
}
