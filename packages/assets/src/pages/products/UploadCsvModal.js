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
  ChoiceList,
  Banner
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';

export default function UploadCsvModal({
  open,
  onClose,
  files,
  onDrop,
  onRemove,
  onUpload,
  onDownloadTemplate,
  uploading,
  stores,
  selectedStores,
  onStoresChange
}) {
  const storeChoices = stores.map(store => ({
    label: `${store.name} (${store.shopDomain})`,
    value: store.id
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Products from CSV"
      primaryAction={{
        content:
          files.length > 0 && selectedStores.length > 0
            ? `Upload ${files.length} File${files.length !== 1 ? 's' : ''} to ${selectedStores.length} Store${selectedStores.length !== 1 ? 's' : ''}`
            : 'Upload',
        onAction: onUpload,
        loading: uploading,
        disabled: files.length === 0 || selectedStores.length === 0
      }}
      secondaryActions={[{content: 'Cancel', onAction: onClose, disabled: uploading}]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text variant="headingSm" as="h3">
            Step 1: Select CSV Files
          </Text>
          <DropZone
            onDrop={onDrop}
            accept=".csv,text/csv"
            type="file"
            allowMultiple
            disabled={uploading}
          >
            <DropZone.FileUpload actionHint="Accepts .csv files" />
          </DropZone>

          {files.length > 0 && (
            <BlockStack gap="200">
              <Text variant="bodySm" fontWeight="semibold">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
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

          <Button onClick={onDownloadTemplate} variant="plain" size="slim">
            Download CSV template
          </Button>
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="400">
          <Text variant="headingSm" as="h3">
            Step 2: Select Target Stores
          </Text>

          {stores.length === 0 ? (
            <Banner tone="warning">No stores available. Please add a store first.</Banner>
          ) : (
            <ChoiceList
              title="Import products to these stores"
              titleHidden
              allowMultiple
              choices={storeChoices}
              selected={selectedStores}
              onChange={onStoresChange}
              disabled={uploading}
            />
          )}

          {selectedStores.length > 0 && files.length > 0 && (
            <Banner tone="info">
              <Text as="p">
                {files.length} file(s) will be imported to {selectedStores.length} store(s)
                simultaneously.
              </Text>
            </Banner>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
