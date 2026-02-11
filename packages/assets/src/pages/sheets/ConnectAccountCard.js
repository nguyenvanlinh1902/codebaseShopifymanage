import React from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, Text, InlineStack, Button} from '@shopify/polaris';

/**
 * Card prompting user to connect their Google account
 */
export default function ConnectAccountCard({onConnect}) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Connect your Google Account
        </Text>
        <Text as="p" tone="subdued">
          Connect your Google account to browse and select spreadsheets directly from your Google
          Drive. This is a one-time setup.
        </Text>
        <InlineStack>
          <Button variant="primary" onClick={onConnect}>
            Connect Google Account
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

ConnectAccountCard.propTypes = {
  onConnect: PropTypes.func.isRequired
};
