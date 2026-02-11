import React from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  List,
  Divider,
  Button,
  Icon,
  Box,
  Badge
} from '@shopify/polaris';
import {ExternalIcon} from '@shopify/polaris-icons';
import VideoDemo from './VideoDemo';

export default function StoresGuideContent({stores, hasStores}) {
  return (
    <BlockStack gap="300">
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to connect a store:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Stores</strong> page and click <strong>"Add Store"</strong>
        </List.Item>
        <List.Item>
          Enter your Shopify store domain (e.g. <code>my-store.myshopify.com</code>)
        </List.Item>
        <List.Item>
          Provide your <strong>Admin API Access Token</strong> from Shopify Admin {'->'} Settings{' '}
          {'->'} Apps and sales channels {'->'} Develop apps
        </List.Item>
        <List.Item>
          Click <strong>"Verify & Connect"</strong> to validate the credentials
        </List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        How to get your Access Token:
      </Text>
      <List type="number">
        <List.Item>
          In Shopify Admin, go to <strong>Settings {'->'} Apps and sales channels</strong>
        </List.Item>
        <List.Item>
          Click <strong>"Develop apps"</strong>, then <strong>"Create an app"</strong>
          <br />
          <InlineStack gap="100" blockAlign="center">
            <Text variant="bodySm" as="span">
              Or go directly to:
            </Text>
            <Button
              url="https://admin.shopify.com/settings/apps/development"
              external
              size="micro"
              variant="plain"
            >
              App Development <Icon source={ExternalIcon} />
            </Button>
          </InlineStack>
        </List.Item>
        <List.Item>
          Under <strong>API credentials</strong>, configure the required scopes:
          <br />
          <code>
            read_orders, write_orders, read_products, write_products, read_shipping, write_shipping
          </code>
        </List.Item>
        <List.Item>
          Install the app and copy the <strong>Admin API access token</strong>
        </List.Item>
      </List>

      <Divider />
      <Text variant="bodySm" as="p" fontWeight="semibold">
        Video Demo:
      </Text>
      <VideoDemo src="https://cdn.shopify.com/videos/c/o/v/3fb7f4122ae541ef97f9cb8a468505b4.mov" />

      {hasStores && (
        <>
          <Divider />
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Your stores:
          </Text>
          <BlockStack gap="200">
            {stores.map(store => (
              <Box
                key={store.id}
                padding="200"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      {store.name}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {store.shopDomain}.myshopify.com
                    </Text>
                  </BlockStack>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
