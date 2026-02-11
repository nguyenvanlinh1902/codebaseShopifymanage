import React from 'react';
import {Modal, BlockStack, Text, ChoiceList, Banner} from '@shopify/polaris';

/**
 * ReimportModal Component
 * Modal for re-importing selected products to other stores
 */
export default function ReimportModal({
  open,
  stores,
  selectedProductsCount,
  reimportStores,
  reimporting,
  onClose,
  onReimportStoresChange,
  onReimport
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Selected Products to Other Stores"
      primaryAction={{
        content: `Import to ${reimportStores.length} Store${
          reimportStores.length !== 1 ? 's' : ''
        }`,
        onAction: onReimport,
        loading: reimporting,
        disabled: reimportStores.length === 0
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="p">
            You have selected <strong>{selectedProductsCount}</strong> product
            {selectedProductsCount !== 1 ? 's' : ''}. Choose which stores to import them to:
          </Text>

          <ChoiceList
            title="Select target stores"
            allowMultiple
            choices={stores.map(store => ({
              label: `${store.name} (${store.shopDomain})`,
              value: store.id
            }))}
            selected={reimportStores}
            onChange={onReimportStoresChange}
          />

          <Banner tone="warning">
            <Text as="p">
              <strong>Note:</strong> If products with the same SKU already exist in the target
              stores, they will be updated. Otherwise, new products will be created.
            </Text>
          </Banner>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
