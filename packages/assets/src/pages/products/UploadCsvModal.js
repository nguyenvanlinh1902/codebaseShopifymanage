import React, {useState} from 'react';
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
  Banner,
  Select,
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';

/** Shopify daily variant limit resets at midnight UTC */
function isThrottledToday(store) {
  if (!store.variantThrottledAt) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  return store.variantThrottledAt.slice(0, 10) === todayUtc;
}

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
  onStoresChange,
  groups = [],
  isAdmin = false
}) {
  const [selectedGroup, setSelectedGroup] = useState('');

  const filteredStores = selectedGroup
    ? stores.filter(s => s.groupId === selectedGroup)
    : stores;

  const throttledStores = filteredStores.filter(isThrottledToday);

  const storeChoices = filteredStores.map(store => {
    const throttled = isThrottledToday(store);
    return {
      label: throttled
        ? `${store.name} (${store.shopDomain}) — Daily variant limit reached, retry tomorrow`
        : `${store.name} (${store.shopDomain})`,
      value: store.id,
      disabled: throttled
    };
  });

  const groupOptions = [
    {label: 'All groups', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];

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

          {isAdmin && groups.length > 0 && (
            <Select
              label="Filter by group"
              options={groupOptions}
              value={selectedGroup}
              onChange={setSelectedGroup}
              disabled={uploading}
            />
          )}

          {throttledStores.length > 0 && (
            <Banner tone="critical">
              <Text as="p">
                <strong>Daily variant limit reached:</strong>{' '}
                {throttledStores.map(s => s.name || s.shopDomain).join(', ')} cannot import today.
                Shopify resets this limit at midnight UTC.
              </Text>
            </Banner>
          )}

          {filteredStores.length === 0 ? (
            <Banner tone="warning">
              {stores.length === 0
                ? 'No stores available. Please add a store first.'
                : 'No stores in this group.'}
            </Banner>
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
