import React from 'react';
import PropTypes from 'prop-types';
import {Card, InlineStack, BlockStack, Text, Button, Box, Icon} from '@shopify/polaris';
import {CheckCircleIcon} from '@shopify/polaris-icons';

export default function ActiveSyncCard({activeSync, onManageClick}) {
  if (!activeSync) return null;

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <InlineStack gap="400" blockAlign="center">
          <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
            <Icon source={CheckCircleIcon} tone="success" />
          </Box>
          <BlockStack gap="050">
            <Text variant="headingSm" as="h3" fontWeight="semibold">
              Active Sync
            </Text>
            <Text variant="bodySm" tone="subdued">
              {activeSync.sheetName || 'Sheet'} / {activeSync.targetSheet || 'Tab'}
              {' · '}
              {activeSync.totalOrdersSynced || 0} orders synced
              {activeSync.lastSyncAt &&
                ` · Last: ${new Date(activeSync.lastSyncAt).toLocaleDateString()}`}
            </Text>
          </BlockStack>
        </InlineStack>
        <Button onClick={onManageClick} variant="plain">
          Manage
        </Button>
      </InlineStack>
    </Card>
  );
}

ActiveSyncCard.propTypes = {
  activeSync: PropTypes.shape({
    sheetName: PropTypes.string,
    targetSheet: PropTypes.string,
    totalOrdersSynced: PropTypes.number,
    lastSyncAt: PropTypes.string
  }),
  onManageClick: PropTypes.func.isRequired
};
