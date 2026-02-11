import React from 'react';
import {Select, Button, Text, DropZone} from '@shopify/polaris';

/**
 * Excel Upload Tab Component
 * Handles Excel file upload and template download
 */
export default function ExcelUploadTab({
  storeOptions,
  selectedStore,
  onStoreChange,
  file,
  uploading,
  onDropZoneDrop,
  onUpload,
  onDownloadTemplate,
  onFileRemove
}) {
  const uploadFileMarkup = file ? (
    <div style={{padding: '16px', textAlign: 'center'}}>
      <Text variant="bodyMd" as="p">
        {file.name}
      </Text>
      <Text variant="bodySm" as="p" tone="subdued">
        {(file.size / 1024).toFixed(2)} KB
      </Text>
      <div style={{marginTop: '8px'}}>
        <Button size="slim" onClick={onFileRemove}>
          Remove
        </Button>
      </div>
    </div>
  ) : (
    <DropZone.FileUpload actionHint="Accepts .xlsx, .xls files" />
  );

  return (
    <div style={{marginTop: '16px'}}>
      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Store"
          options={storeOptions}
          value={selectedStore}
          onChange={onStoreChange}
          placeholder="Choose a store"
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <Text variant="bodyMd" as="p" fontWeight="medium">
          Upload Excel File
        </Text>
        <div style={{marginTop: '8px'}}>
          <DropZone onDrop={onDropZoneDrop} accept=".xlsx,.xls" type="file" disabled={uploading}>
            {uploadFileMarkup}
          </DropZone>
        </div>
      </div>

      <div style={{display: 'flex', gap: '8px'}}>
        <Button
          variant="primary"
          fullWidth
          onClick={onUpload}
          loading={uploading}
          disabled={!selectedStore || !file}
        >
          Upload & Process
        </Button>
        <Button onClick={onDownloadTemplate}>Download Template</Button>
      </div>
    </div>
  );
}
