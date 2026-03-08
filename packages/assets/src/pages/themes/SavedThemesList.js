import React from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  SkeletonBodyText,
  Box,
  Badge,
  Divider
} from '@shopify/polaris';
import {RefreshIcon, ImportIcon, DeleteIcon} from '@shopify/polaris-icons';

export default function SavedThemesList({
  importedThemes,
  importedLoading,
  loadImportedThemes,
  setReimportModal,
  setReimportStores,
  setConfirmDeleteRecord,
  formatFileSize
}) {
  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">Theme Library</Text>
          <Text tone="subdued" variant="bodySm">
            Upload a theme once — re-import to any store without re-uploading
          </Text>
        </BlockStack>
        <Button icon={RefreshIcon} onClick={loadImportedThemes} disabled={importedLoading}>
          Refresh
        </Button>
      </InlineStack>

      {importedLoading ? (
        <BlockStack gap="300">
          <SkeletonBodyText lines={3} />
          <SkeletonBodyText lines={3} />
        </BlockStack>
      ) : importedThemes.length === 0 ? (
        <Box padding="1000" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="200" inlineAlign="center">
            <Text tone="subdued" alignment="center" fontWeight="semibold">No saved themes</Text>
            <Text tone="subdued" alignment="center" variant="bodySm">
              Import a theme using the "Import Theme" button — the file will be saved here for future re-use
            </Text>
          </BlockStack>
        </Box>
      ) : (
        <BlockStack gap="300">
          {importedThemes.map((record, i) => (
            <Box
              key={record.id}
              background="bg-surface"
              borderWidth="025"
              borderColor="border"
              borderRadius="200"
              padding="400"
            >
              <BlockStack gap="300">
                {/* Header row */}
                <InlineStack align="space-between" blockAlign="start" wrap={false}>
                  <BlockStack gap="100">
                    <Text variant="headingSm" fontWeight="bold">{record.themeName}</Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Text tone="subdued" variant="bodySm">{record.fileName}</Text>
                      <Badge>{formatFileSize(record.fileSize)}</Badge>
                    </InlineStack>
                    <Text tone="subdued" variant="bodySm">
                      Uploaded {new Date(record.createdAt).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'})}
                      {' · '}{new Date(record.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}
                    </Text>
                  </BlockStack>

                  <InlineStack gap="200">
                    <Button
                      size="slim"
                      icon={ImportIcon}
                      onClick={() => { setReimportModal(record); setReimportStores([]); }}
                    >
                      Re-import
                    </Button>
                    <Button
                      size="slim"
                      tone="critical"
                      icon={DeleteIcon}
                      onClick={() => setConfirmDeleteRecord(record)}
                    />
                  </InlineStack>
                </InlineStack>

                {/* Imported stores */}
                {record.importedTo?.length > 0 && (
                  <>
                    <Divider />
                    <BlockStack gap="150">
                      <Text variant="bodySm" tone="subdued" fontWeight="semibold">
                        Imported to {record.importedTo.length} store{record.importedTo.length !== 1 ? 's' : ''}
                      </Text>
                      <InlineStack gap="150" wrap>
                        {record.importedTo.map((item, idx) => (
                          <Badge key={idx} tone="success">{item.storeName}</Badge>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Box>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}
