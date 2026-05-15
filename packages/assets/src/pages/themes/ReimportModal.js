import React, {useMemo} from 'react';
import {Modal, BlockStack, Text} from '@shopify/polaris';
import SearchableChoiceList from '../../components/searchable-choice-list';

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
  const choices = useMemo(
    () =>
      stores.map(store => ({
        label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
        value: store.id
      })),
    [stores]
  );
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
          <SearchableChoiceList
            title="Select stores to import to"
            choices={choices}
            selected={reimportStores}
            onChange={setReimportStores}
            disabled={reimporting}
            showSelectAll
            searchPlaceholder="Search stores..."
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
