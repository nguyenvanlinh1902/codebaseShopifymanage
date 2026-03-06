import React from 'react';
import {Card, Text, BlockStack, InlineStack, Button, Icon, Box} from '@shopify/polaris';
import {EmailIcon} from '@shopify/polaris-icons';

export default function ContactSupport() {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" blockAlign="center">
          <Box background="bg-fill-info-secondary" borderRadius="300" padding="200">
            <Icon source={EmailIcon} />
          </Box>
          <Text variant="headingSm" as="h3" fontWeight="semibold">
            Contact Support
          </Text>
        </InlineStack>
        <Text variant="bodySm" tone="subdued">
          Need help? Our team is available to assist you with any questions or issues.
        </Text>
        <Button url="mailto:support@trackingorder-1c98b.firebaseapp.com" external>
          Email Support
        </Button>
      </BlockStack>
    </Card>
  );
}
