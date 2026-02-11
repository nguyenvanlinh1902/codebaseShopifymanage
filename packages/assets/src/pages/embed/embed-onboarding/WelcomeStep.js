import React from 'react';
import {BlockStack, Text, InlineGrid} from '@shopify/polaris';
import {ProductIcon, OrderIcon, NoteIcon} from '@shopify/polaris-icons';
import {FeatureCard} from './FeatureCard';

export function WelcomeStep() {
  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h2">
          Welcome to ToolTrackingOrder!
        </Text>
        <Text tone="subdued">
          Powerful tools to manage your Shopify store. Let's get you set up in a few quick steps.
        </Text>
      </BlockStack>
      <InlineGrid columns={3} gap="400">
        <FeatureCard
          icon={ProductIcon}
          bg="bg-fill-info-secondary"
          title="Product Import"
          description="Bulk import products from CSV files directly to your store."
        />
        <FeatureCard
          icon={OrderIcon}
          bg="bg-fill-success-secondary"
          title="Order Sync"
          description="Automatically export orders to Google Sheets for tracking."
        />
        <FeatureCard
          icon={NoteIcon}
          bg="bg-fill-caution-secondary"
          title="Tracking Updates"
          description="Update fulfillment tracking info from your spreadsheets."
        />
      </InlineGrid>
    </BlockStack>
  );
}
