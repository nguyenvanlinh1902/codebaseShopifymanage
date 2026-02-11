import React from 'react';
import {BlockStack, Text, Card, InlineStack, Box, Banner} from '@shopify/polaris';

export function ConfigureStep() {
  const steps = [
    'Go to the Orders & Sheets page',
    'Select a Google Sheet from the dropdown',
    'Choose a tab within the sheet',
    'Click Setup Sync to create the configuration',
    'Click Sync Now to start your first sync'
  ];

  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h2">
          Configure Your First Sync
        </Text>
        <Text tone="subdued">Follow these steps to start syncing orders to Google Sheets.</Text>
      </BlockStack>
      <Card>
        <BlockStack gap="300">
          {steps.map((step, i) => (
            <InlineStack key={i} gap="300" blockAlign="start" wrap={false}>
              <Box
                background="bg-fill-info-secondary"
                borderRadius="full"
                padding="100"
                minWidth="24px"
                minHeight="24px"
              >
                <InlineStack align="center">
                  <Text variant="bodySm" fontWeight="bold" alignment="center">
                    {i + 1}
                  </Text>
                </InlineStack>
              </Box>
              <Text variant="bodyMd">{step}</Text>
            </InlineStack>
          ))}
        </BlockStack>
      </Card>
      <Banner tone="info">You can also import products from CSV on the Products page.</Banner>
    </BlockStack>
  );
}
