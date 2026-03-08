import React from 'react';
import {BlockStack, Text, List, Divider, Banner, Box} from '@shopify/polaris';
import VideoDemo from './VideoDemo';

export default function TrackingGuideContent() {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to update tracking:
      </Text>
      <List type="number">
        <List.Item>Go to <strong>Tracking</strong> page</List.Item>
        <List.Item>Select the <strong>Store</strong> to update tracking for</List.Item>
        <List.Item>Upload an <strong>Excel file</strong> with tracking data (or download the template first)</List.Item>
        <List.Item>The system matches orders by order number and updates fulfillment tracking automatically</List.Item>
        <List.Item>View per-order results: success/failure with error details</List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Excel template columns:
      </Text>
      <Box padding="200" background="bg-surface-secondary" borderRadius="200">
        <Text variant="bodySm" as="p">
          <code>Order Number, Tracking Number, Carrier (optional), Tracking URL (optional)</code>
        </Text>
      </Box>

      <Banner tone="info">
        <p>
          Tracking updates are processed asynchronously. You&apos;ll see a progress bar and can view
          per-order results including any errors with helpful context messages.
        </p>
      </Banner>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Video Demo:
      </Text>
      <VideoDemo src="https://cdn.shopify.com/videos/c/o/v/89cc565b870542fb8a8000bee35560b1.mov" />
    </BlockStack>
  );
}
