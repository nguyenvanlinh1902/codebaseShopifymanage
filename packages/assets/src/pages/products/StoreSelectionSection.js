import React from 'react';
import {Card, BlockStack, Text, Banner, ChoiceList, InlineStack, Button} from '@shopify/polaris';

/**
 * StoreSelectionSection Component
 * Allows selection of target stores for product import
 */
export default function StoreSelectionSection({
  stores,
  selectedStores,
  files,
  uploading,
  onStoresChange,
  onUpload
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Step 2: Select Target Stores
        </Text>

        {files.length === 0 && (
          <Banner tone="warning">
            <Text as="p">Please upload CSV file(s) first before selecting stores.</Text>
          </Banner>
        )}

        {files.length > 0 && (
          <Banner tone="info">
            <Text as="p">
              <strong>{files.length} file(s) ready:</strong> {files.map(f => f.name).join(', ')}
            </Text>
          </Banner>
        )}

        <ChoiceList
          title="Import products to these stores (multiple selection allowed)"
          allowMultiple
          choices={stores.map(store => ({
            label: `${store.name} (${store.shopDomain})`,
            value: store.id
          }))}
          selected={selectedStores}
          onChange={onStoresChange}
          disabled={uploading || files.length === 0}
        />

        {selectedStores.length > 0 && files.length > 0 && (
          <Banner tone="success">
            <Text as="p">
              <strong>{selectedStores.length} store(s) selected:</strong> {files.length} file(s)
              will be imported to all selected stores simultaneously.
            </Text>
          </Banner>
        )}

        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={onUpload}
            loading={uploading}
            disabled={selectedStores.length === 0 || files.length === 0}
          >
            Upload & Import {files.length} File{files.length !== 1 ? 's' : ''} to{' '}
            {selectedStores.length} Store
            {selectedStores.length !== 1 ? 's' : ''}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
