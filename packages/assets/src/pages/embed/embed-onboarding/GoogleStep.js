import React from 'react';
import PropTypes from 'prop-types';
import {BlockStack, Text, Banner, Card, InlineStack, Box, Icon, Button} from '@shopify/polaris';
import {NoteIcon} from '@shopify/polaris-icons';

export function GoogleStep({googleConnected, onConnectGoogle}) {
  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h2">
          Connect Google Account
        </Text>
        <Text tone="subdued">
          To sync orders to Google Sheets, connect your Google account. We only request access to
          Google Sheets.
        </Text>
      </BlockStack>
      {googleConnected ? (
        <Banner tone="success">Google account connected successfully!</Banner>
      ) : (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="center">
              <Box background="bg-fill-caution-secondary" borderRadius="300" padding="200">
                <Icon source={NoteIcon} />
              </Box>
              <BlockStack gap="050">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Google Sheets Access
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Only Sheets access is requested. No other data is accessed.
                </Text>
              </BlockStack>
            </InlineStack>
            <Button variant="primary" onClick={onConnectGoogle}>
              Connect Google Account
            </Button>
          </BlockStack>
        </Card>
      )}
      <Text variant="bodySm" tone="subdued">
        You can also skip this step and connect later from the Orders page.
      </Text>
    </BlockStack>
  );
}

GoogleStep.propTypes = {
  googleConnected: PropTypes.bool.isRequired,
  onConnectGoogle: PropTypes.func.isRequired
};
