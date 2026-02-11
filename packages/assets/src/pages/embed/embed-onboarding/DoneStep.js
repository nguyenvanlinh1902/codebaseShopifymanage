import React from 'react';
import PropTypes from 'prop-types';
import {BlockStack, Text, Box, Icon, InlineStack, Button} from '@shopify/polaris';
import {CheckCircleIcon, ArrowRightIcon} from '@shopify/polaris-icons';

export function DoneStep({onFinish}) {
  return (
    <BlockStack gap="500">
      <Box paddingBlockStart="400">
        <BlockStack gap="300" inlineAlign="center">
          <Box background="bg-fill-success-secondary" borderRadius="full" padding="400">
            <Icon source={CheckCircleIcon} tone="success" />
          </Box>
          <Text variant="headingLg" as="h2" alignment="center">
            You're all set!
          </Text>
          <Text tone="subdued" alignment="center">
            Your ToolTrackingOrder app is ready to use. Head to the Dashboard to get started.
          </Text>
          <Box paddingBlockStart="200">
            <InlineStack align="center">
              <Button variant="primary" size="large" onClick={onFinish} icon={ArrowRightIcon}>
                Go to Dashboard
              </Button>
            </InlineStack>
          </Box>
        </BlockStack>
      </Box>
    </BlockStack>
  );
}

DoneStep.propTypes = {
  onFinish: PropTypes.func.isRequired
};
