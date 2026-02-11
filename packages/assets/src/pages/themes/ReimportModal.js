import React from 'react';
import {Modal, BlockStack, Text, ChoiceList} from '@shopify/polaris';

export default function ReimportModal({
  reimportModal,
  setReimportModal,
  reimportStores,
  setReimportStores,
  stores,
  reimporting,
  handleReimport,
  formatFileSize
}) {
  return (
    <Modal
      open={!!reimportModal}
      onClose={() => {
        setReimportModal(null);
        setReimportStores([]);
      }}
      title={`Re-import: ${reimportModal?.themeName || ''}`}
      primaryAction={{
        content: `Import to ${reimportStores.length} Store${
          reimportStores.length !== 1 ? 's' : ''
        }`,
        onAction: handleReimport,
        loading: reimporting,
        disabled: reimportStores.length === 0
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: () => {
            setReimportModal(null);
            setReimportStores([]);
          }
        }
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="bodyMd">
            File: <strong>{reimportModal?.fileName}</strong> (
            {formatFileSize(reimportModal?.fileSize)})
          </Text>
          <ChoiceList
            title="Select stores to import to"
            allowMultiple
            choices={stores.map(store => ({
              label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
              value: store.id
            }))}
            selected={reimportStores}
            onChange={setReimportStores}
            disabled={reimporting}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
