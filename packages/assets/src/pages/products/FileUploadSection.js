import React from 'react';
import {Card, BlockStack, Text, DropZone, InlineStack, Button} from '@shopify/polaris';

/**
 * FileUploadSection Component
 * Handles CSV file upload with multi-file support
 */
export default function FileUploadSection({files, uploading, onDrop, onFileRemove}) {
  const fileUpload = <DropZone.FileUpload />;

  const uploadedFilesList = files.length > 0 && (
    <BlockStack gap="200">
      {files.map((f, index) => (
        <InlineStack key={`${f.name}-${index}`} align="space-between" blockAlign="center">
          <InlineStack gap="200">
            <Text as="p" variant="bodyMd">
              {f.name}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {(f.size / 1024).toFixed(2)} KB
            </Text>
          </InlineStack>
          <Button onClick={() => onFileRemove(index)} size="slim">
            Remove
          </Button>
        </InlineStack>
      ))}
    </BlockStack>
  );

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Step 1: Upload CSV Files
        </Text>
        <DropZone
          onDrop={onDrop}
          accept=".csv,text/csv"
          type="file"
          allowMultiple
          disabled={uploading}
        >
          {fileUpload}
        </DropZone>
        {uploadedFilesList}
      </BlockStack>
    </Card>
  );
}
