import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Icon,
  Divider,
  Banner
} from '@shopify/polaris';
import {CheckCircleIcon, ClockIcon, AlertCircleIcon} from '@shopify/polaris-icons';

/**
 * QueueStatusSection Component
 * Displays queue statistics and manual processing controls
 */
export default function QueueStatusSection({queueStats, processingQueue, onProcessQueue}) {
  if (!queueStats) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Import Queue Status
          </Text>
          <Button
            onClick={onProcessQueue}
            loading={processingQueue}
            disabled={queueStats.pending === 0}
            variant="primary"
          >
            Manual Process Now
          </Button>
        </InlineStack>

        <InlineStack gap="400" wrap>
          <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="150px">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={ClockIcon} tone="base" />
                <Text as="p" variant="bodySm" tone="subdued">
                  Pending
                </Text>
              </InlineStack>
              <Text as="p" variant="heading2xl">
                {queueStats.pending}
              </Text>
            </BlockStack>
          </Box>

          <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="150px">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={ClockIcon} tone="caution" />
                <Text as="p" variant="bodySm" tone="subdued">
                  Processing
                </Text>
              </InlineStack>
              <Text as="p" variant="heading2xl">
                {queueStats.processing}
              </Text>
            </BlockStack>
          </Box>

          <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="150px">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={CheckCircleIcon} tone="success" />
                <Text as="p" variant="bodySm" tone="subdued">
                  Completed
                </Text>
              </InlineStack>
              <Text as="p" variant="heading2xl">
                {queueStats.completed}
              </Text>
            </BlockStack>
          </Box>

          <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="150px">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={AlertCircleIcon} tone="critical" />
                <Text as="p" variant="bodySm" tone="subdued">
                  Failed
                </Text>
              </InlineStack>
              <Text as="p" variant="heading2xl">
                {queueStats.failed}
              </Text>
            </BlockStack>
          </Box>
        </InlineStack>

        <Divider />

        <Banner tone="info">
          <BlockStack gap="200">
            <Text as="p">
              <strong>Automatic Processing (CronJob):</strong>
            </Text>
            <Text as="p" tone="subdued">
              • Runs automatically every minute
            </Text>
            <Text as="p" tone="subdued">
              • Processes up to 100 products per batch
            </Text>
            <Text as="p" tone="subdued">
              • Retries failed products up to 3 times
            </Text>
            <Text as="p" tone="subdued">
              • Queue stats update every 10 seconds
            </Text>
          </BlockStack>
        </Banner>

        <Banner tone="success">
          <Text as="p">
            <strong>Manual Processing:</strong> Click "Manual Process Now" to immediately process
            pending products without waiting for the CronJob.
          </Text>
        </Banner>
      </BlockStack>
    </Card>
  );
}
