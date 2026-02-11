import React from 'react';
import {
  Card,
  BlockStack,
  Text,
  InlineStack,
  Badge,
  Button,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';
import {RefreshIcon, DeleteIcon} from '@shopify/polaris-icons';

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
        <Text as="h2" variant="headingMd">
          Saved Themes ({importedThemes.length})
        </Text>
        <Button icon={RefreshIcon} onClick={loadImportedThemes} disabled={importedLoading}>
          Refresh
        </Button>
      </InlineStack>

      <Text tone="subdued" variant="bodySm">
        Theme files uploaded to our server. You can re-import them to other stores without uploading
        again.
      </Text>

      {importedLoading ? (
        <SkeletonBodyText lines={5} />
      ) : importedThemes.length === 0 ? (
        <EmptyState heading="No saved themes" image="">
          <p>
            When you import a theme via the "Import & Themes" tab, the file will be saved here for
            future use.
          </p>
        </EmptyState>
      ) : (
        importedThemes.map(record => (
          <Card key={record.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="100">
                  <Text variant="headingSm" fontWeight="bold">
                    {record.themeName}
                  </Text>
                  <Text tone="subdued" variant="bodySm">
                    {record.fileName} ({formatFileSize(record.fileSize)})
                  </Text>
                  <Text tone="subdued" variant="bodySm">
                    Uploaded: {new Date(record.createdAt).toLocaleDateString()}{' '}
                    {new Date(record.createdAt).toLocaleTimeString()}
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button
                    size="slim"
                    onClick={() => {
                      setReimportModal(record);
                      setReimportStores([]);
                    }}
                  >
                    Re-import
                  </Button>
                  <Button
                    size="slim"
                    tone="critical"
                    icon={DeleteIcon}
                    onClick={() => setConfirmDeleteRecord(record)}
                  >
                    Delete
                  </Button>
                </InlineStack>
              </InlineStack>

              {record.importedTo && record.importedTo.length > 0 && (
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold">
                    Imported to:
                  </Text>
                  {record.importedTo.map((item, i) => (
                    <InlineStack key={i} gap="200" blockAlign="center">
                      <Badge tone="success">OK</Badge>
                      <Text variant="bodySm">{item.storeName}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        ))
      )}
    </BlockStack>
  );
}
