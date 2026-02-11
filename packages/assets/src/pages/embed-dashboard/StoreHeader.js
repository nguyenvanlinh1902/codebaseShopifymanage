import React from 'react';
import PropTypes from 'prop-types';
import {Card, InlineStack, BlockStack, Text, Badge, Box} from '@shopify/polaris';

export default function StoreHeader({store}) {
  if (!store) return null;

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <InlineStack gap="400" blockAlign="center">
          <Box background="bg-fill-success-secondary" borderRadius="300" padding="300">
            <Text variant="headingLg" as="span">
              {(store.name || store.shopDomain || '?').charAt(0).toUpperCase()}
            </Text>
          </Box>
          <BlockStack gap="050">
            <Text variant="headingMd" as="h2" fontWeight="bold">
              {store.name || store.shopDomain}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {store.shopDomain}.myshopify.com
              {store.plan && ` · ${store.plan}`}
            </Text>
          </BlockStack>
        </InlineStack>
        <Badge tone="success">Connected</Badge>
      </InlineStack>
    </Card>
  );
}

StoreHeader.propTypes = {
  store: PropTypes.shape({
    name: PropTypes.string,
    shopDomain: PropTypes.string,
    plan: PropTypes.string
  })
};
