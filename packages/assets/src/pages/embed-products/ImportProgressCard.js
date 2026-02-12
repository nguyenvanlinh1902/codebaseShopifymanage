import React from 'react';
import {Card, BlockStack, InlineStack, Text, Badge} from '@shopify/polaris';

export default function ImportProgressCard({importProgress}) {
  if (!importProgress) return null;

  // Use variant-based percentage for smoother progress (fallback to product-based)
  const hasVariants = importProgress.totalVariants > 0;
  const percentage = hasVariants
    ? Math.round(((importProgress.processedVariants || 0) / importProgress.totalVariants) * 100)
    : importProgress.completionPercentage;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">
            Importing: {importProgress.fileName}
          </Text>
          <Badge
            tone={
              importProgress.status === 'completed'
                ? 'success'
                : importProgress.status === 'failed'
                ? 'critical'
                : 'attention'
            }
          >
            {percentage}%
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
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: importProgress.failedCount > 0 ? '#d82c0d' : '#008060',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        <InlineStack gap="400">
          <Text variant="bodySm" tone="subdued">
            {importProgress.processedProducts}/{importProgress.totalProducts} products
          </Text>
          {hasVariants && (
            <Text variant="bodySm" tone="subdued">
              {importProgress.processedVariants || 0}/{importProgress.totalVariants} variants
            </Text>
          )}
          {importProgress.successCount > 0 && (
            <Text variant="bodySm" tone="success">
              {importProgress.successCount} success
            </Text>
          )}
          {importProgress.failedCount > 0 && (
            <Text variant="bodySm" tone="critical">
              {importProgress.failedCount} failed
            </Text>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
