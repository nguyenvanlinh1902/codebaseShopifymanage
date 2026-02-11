import React from 'react';
import {Card, BlockStack, InlineStack, Text, Badge, ProgressBar} from '@shopify/polaris';

export default function SetupProgressCard({completedSteps, totalSteps, progressPct}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">
            Setup Progress
          </Text>
          <Badge tone={completedSteps >= 3 ? 'success' : 'attention'}>
            {completedSteps}/{totalSteps} completed
          </Badge>
        </InlineStack>
        <ProgressBar
          progress={progressPct}
          tone={progressPct >= 60 ? 'success' : 'primary'}
          size="small"
        />
        <Text variant="bodySm" as="p" tone="subdued">
          Complete all steps below to fully set up your multi-store integration.
        </Text>
      </BlockStack>
    </Card>
  );
}
