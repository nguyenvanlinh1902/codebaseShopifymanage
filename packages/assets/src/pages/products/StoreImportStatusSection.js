import React from 'react';
import {Card, BlockStack, Text, Box, InlineStack, Badge, Divider} from '@shopify/polaris';

/**
 * StoreImportStatusSection Component
 * Displays import status and history by store
 */
export default function StoreImportStatusSection({storeImportStatus}) {
  if (!storeImportStatus || storeImportStatus.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Import Status by Store
        </Text>

        {storeImportStatus.map(storeImport => {
          const totalSuccess = storeImport.imports.reduce(
            (sum, imp) => sum + (imp.successCount || 0),
            0
          );
          const latestImport = storeImport.imports[0];

          return (
            <Box
              key={storeImport.storeId}
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="p" variant="headingSm" fontWeight="semibold">
                      {storeImport.storeName}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {storeImport.shopDomain}
                    </Text>
                  </BlockStack>
                  <Badge tone="success">{totalSuccess} products imported</Badge>
                </InlineStack>

                <Divider />

                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Recent Imports:
                </Text>

                {storeImport.imports.slice(0, 3).map(imp => (
                  <Box key={imp.importId} padding="200" background="bg-surface" borderRadius="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="p" variant="bodySm">
                          {imp.fileName}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {new Date(imp.completedAt).toLocaleString()}
                        </Text>
                      </BlockStack>
                      <Badge tone="success">{imp.successCount} products</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </Box>
          );
        })}
      </BlockStack>
    </Card>
  );
}
