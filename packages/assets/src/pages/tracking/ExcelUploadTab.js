import React from 'react';
import {Button, Text, DropZone, BlockStack, InlineStack, Badge, Box} from '@shopify/polaris';

/**
 * Excel Upload Tab
 * Store selector is at page level — this tab handles file upload only.
 */
export default function ExcelUploadTab({
  file,
  uploading,
  onDropZoneDrop,
  onUpload,
  onDownloadTemplate,
  onFileRemove,
  canUpload
}) {
  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <Text variant="bodyMd" fontWeight="semibold">Excel File (.xlsx, .xls)</Text>
        <DropZone onDrop={onDropZoneDrop} accept=".xlsx,.xls" type="file" disabled={uploading}>
          {file ? (
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodyMd" fontWeight="medium">{file.name}</Text>
                    <Text tone="subdued" variant="bodySm">{(file.size / 1024).toFixed(1)} KB</Text>
                  </BlockStack>
                  <Badge tone="success">Ready</Badge>
                </InlineStack>
                <button
                  onClick={e => { e.stopPropagation(); onFileRemove(); }}
                  style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-color-text-critical)', fontSize: '13px', padding: '4px 8px'}}
                >
                  Remove
                </button>
              </InlineStack>
            </Box>
          ) : (
            <DropZone.FileUpload actionTitle="Add Excel file" actionHint="Accepts .xlsx and .xls" />
          )}
        </DropZone>
      </BlockStack>

      <InlineStack gap="200" align="start">
        <Button
          variant="primary"
          onClick={onUpload}
          loading={uploading}
          disabled={!canUpload || !file}
        >
          Upload & Process
        </Button>
        <Button onClick={onDownloadTemplate}>Download Template</Button>
        {!canUpload && (
          <Text tone="subdued" variant="bodySm">Select a store above to upload</Text>
        )}
      </InlineStack>
    </BlockStack>
  );
}
