import React from 'react';
import {Card, BlockStack, InlineStack, Text, Button, Box, Icon, Badge} from '@shopify/polaris';
import {CheckCircleIcon, ClockIcon, AlertCircleIcon} from '@shopify/polaris-icons';

/**
 * QueueStatusSection Component
 * Shows active import progress cards (embed-style) + queue summary + manual process
 */
export default function QueueStatusSection({queueStats, processingQueue, onProcessQueue}) {
  if (!queueStats) return null;

  const activeImports = queueStats.activeImports || [];

  return (
    <BlockStack gap="400">
      {/* Active import progress cards */}
      {activeImports.map(imp => (
        <Card key={imp.importId}>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">
                  {imp.fileName || 'Import'}
                </Text>
                {imp.storeName && (
                  <Text variant="bodySm" tone="subdued">
                    {imp.storeName}
                  </Text>
                )}
              </BlockStack>
              <Badge
                tone={
                  imp.status === 'completed'
                    ? 'success'
                    : imp.status === 'failed'
                      ? 'critical'
                      : 'attention'
                }
              >
                {imp.completionPercentage}%
              </Badge>
            </InlineStack>

            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e4e5e7',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${imp.completionPercentage}%`,
                  height: '100%',
                  backgroundColor: imp.failedCount > 0 ? '#d82c0d' : '#008060',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            <InlineStack gap="400">
              <Text variant="bodySm" tone="subdued">
                {imp.processedProducts}/{imp.totalProducts} products
              </Text>
              {imp.successCount > 0 && (
                <Text variant="bodySm" tone="success">
                  {imp.successCount} created
                </Text>
              )}
              {imp.failedCount > 0 && (
                <Text variant="bodySm" tone="critical">
                  {imp.failedCount} failed
                </Text>
              )}
              {imp.skippedCount > 0 && (
                <Text variant="bodySm" tone="subdued">
                  {imp.skippedCount} skipped
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </Card>
      ))}

      {/* Queue summary */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              Import Queue
            </Text>
            <Button
              onClick={onProcessQueue}
              loading={processingQueue}
              disabled={queueStats.pending === 0}
              variant="primary"
              size="slim"
            >
              Process Now
            </Button>
          </InlineStack>

          <InlineStack gap="400" wrap>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={ClockIcon} tone="base" />
                  <Text variant="bodySm" tone="subdued">Pending</Text>
                </InlineStack>
                <Text variant="headingLg">{queueStats.pending}</Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={ClockIcon} tone="caution" />
                  <Text variant="bodySm" tone="subdued">Processing</Text>
                </InlineStack>
                <Text variant="headingLg">{queueStats.processing}</Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={CheckCircleIcon} tone="success" />
                  <Text variant="bodySm" tone="subdued">Completed</Text>
                </InlineStack>
                <Text variant="headingLg">{queueStats.completed}</Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={AlertCircleIcon} tone="critical" />
                  <Text variant="bodySm" tone="subdued">Failed</Text>
                </InlineStack>
                <Text variant="headingLg">{queueStats.failed}</Text>
              </BlockStack>
            </Box>
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
