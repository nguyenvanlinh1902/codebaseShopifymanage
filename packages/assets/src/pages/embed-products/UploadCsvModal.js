import React from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  DropZone,
  Divider,
  Banner,
  ProgressBar,
  Checkbox
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';
import {MAX_FILES} from '../../helpers/storage-upload';

export default function UploadCsvModal({
  open,
  onClose,
  files,
  onDrop,
  onRemove,
  onUpload,
  onDownloadTemplate,
  uploading,
  uploadProgress = 0,
  uploadingFileName = '',
  overwriteExisting = true,
  onOverwriteChange
}) {
  const tooManyFiles = files.length > MAX_FILES;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Products from CSV"
      primaryAction={{
        content: files.length > 0
          ? `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`
          : 'Upload',
        onAction: onUpload,
        loading: uploading,
        disabled: files.length === 0 || tooManyFiles
      }}
      secondaryActions={[{content: 'Cancel', onAction: onClose, disabled: uploading}]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <DropZone onDrop={onDrop} accept=".csv,text/csv" type="file" allowMultiple disabled={uploading}>
            <DropZone.FileUpload actionHint={`Accepts .csv files (max ${MAX_FILES})`} />
          </DropZone>

          {tooManyFiles && (
            <Banner tone="critical">
              Too many files selected ({files.length}). Maximum {MAX_FILES} files per batch.
            </Banner>
          )}

          {files.length > 0 && (
            <BlockStack gap="200">
              <Text variant="bodySm" fontWeight="semibold">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
                ({(files.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(1)} MB total)
              </Text>
              <Divider />
              {files.map((f, index) => (
                <InlineStack key={`${f.name}-${index}`} align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge size="small">{(f.size / 1024).toFixed(1)} KB</Badge>
                    <Text variant="bodyMd">{f.name}</Text>
                  </InlineStack>
                  <Button
                    onClick={() => onRemove(index)}
                    icon={DeleteIcon}
                    size="slim"
                    tone="critical"
                    variant="plain"
                    disabled={uploading}
                  />
                </InlineStack>
              ))}
            </BlockStack>
          )}

          {uploading && (
            <BlockStack gap="200">
              <Text variant="bodySm">
                {uploadingFileName ? `Uploading: ${uploadingFileName}` : 'Processing...'}
              </Text>
              <ProgressBar progress={uploadProgress} size="small" />
            </BlockStack>
          )}

          <Checkbox
            label="Overwrite existing products (match by handle)"
            checked={overwriteExisting}
            onChange={onOverwriteChange}
            disabled={uploading}
            helpText="If a product with the same handle already exists, it will be updated"
          />

          <Button onClick={onDownloadTemplate} variant="plain" size="slim">
            Download CSV template
          </Button>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
