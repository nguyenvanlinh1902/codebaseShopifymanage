import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Box,
  Icon,
  Text,
  Banner,
  Select,
  Button,
  SkeletonBodyText
} from '@shopify/polaris';
import {OrderIcon} from '@shopify/polaris-icons';
import EmptyStateSheet from './EmptyStateSheet';

/**
 * Main sync configuration card with sheet selection and sync controls
 */
export default function SyncConfigurationCard({
  activeConfig,
  loading,
  sheets,
  sheetOptions,
  selectedSheet,
  onSheetChange,
  addingSheet,
  onAddSheet,
  sheetTabs,
  selectedTab,
  onTabChange,
  loadingTabs,
  settingUpSync,
  onSetupSync,
  checkingWebhooks,
  onCheckWebhooks
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="300" blockAlign="center">
          <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
            <Icon source={OrderIcon} />
          </Box>
          <Text variant="headingMd" as="h2">
            {activeConfig ? 'Sync Configuration' : 'Setup Sync'}
          </Text>
        </InlineStack>

        {activeConfig && (
          <Banner tone="info">
            <BlockStack gap="100">
              <Text variant="bodySm" fontWeight="semibold">
                Sheet: {activeConfig.sheetName} / Tab: {activeConfig.targetSheet}
              </Text>
              <Text variant="bodySm">
                {activeConfig.totalOrdersSynced || 0} orders synced
                {activeConfig.lastSyncAt &&
                  ` · Last: ${new Date(activeConfig.lastSyncAt).toLocaleString()}`}
              </Text>
            </BlockStack>
          </Banner>
        )}

        {loading ? (
          <SkeletonBodyText lines={5} />
        ) : sheets.length === 0 ? (
          <EmptyStateSheet onAddSheet={onAddSheet} addingSheet={addingSheet} />
        ) : (
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="end" wrap={false}>
              <Box width="100%">
                <Select
                  label="Select Google Sheet"
                  options={sheetOptions}
                  value={selectedSheet}
                  onChange={onSheetChange}
                  placeholder="Choose a sheet"
                />
              </Box>
              <Box minWidth="fit-content">
                <Button onClick={onAddSheet} loading={addingSheet}>
                  Add Sheet
                </Button>
              </Box>
            </InlineStack>

            <Select
              label="Sheet Tab"
              options={sheetTabs.map(tab => ({
                label: tab.title,
                value: `${tab.title}|${tab.sheetId}`
              }))}
              value={selectedTab}
              onChange={onTabChange}
              placeholder="Choose a tab"
              disabled={loadingTabs || sheetTabs.length === 0}
            />

            <InlineStack gap="200" wrap>
              <Button
                variant="primary"
                onClick={onSetupSync}
                loading={settingUpSync}
                disabled={!selectedSheet || !selectedTab}
              >
                {activeConfig ? 'Update Config' : 'Setup Sync'}
              </Button>

              {activeConfig && (
                <Button onClick={onCheckWebhooks} loading={checkingWebhooks}>
                  Check Webhooks
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
