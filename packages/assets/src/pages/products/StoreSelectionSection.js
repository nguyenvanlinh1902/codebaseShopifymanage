import React from 'react';
import {Card, BlockStack, Text, Banner, ChoiceList, InlineStack, Button} from '@shopify/polaris';

/** Shopify daily variant limit resets at midnight UTC */
function isThrottledToday(store) {
  if (!store.variantThrottledAt) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  return store.variantThrottledAt.slice(0, 10) === todayUtc;
}

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
  const throttledStores = stores.filter(isThrottledToday);

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

        {throttledStores.length > 0 && (
          <Banner tone="critical">
            <Text as="p">
              <strong>Daily variant limit reached:</strong>{' '}
              {throttledStores.map(s => s.name || s.shopDomain).join(', ')} cannot import today.
              Shopify resets this limit at midnight UTC.
            </Text>
          </Banner>
        )}

        <ChoiceList
          title="Import products to these stores (multiple selection allowed)"
          allowMultiple
          choices={stores.map(store => {
            const throttled = isThrottledToday(store);
            return {
              label: throttled
                ? `${store.name} (${store.shopDomain}) — Daily variant limit reached, retry tomorrow`
                : `${store.name} (${store.shopDomain})`,
              value: store.id,
              disabled: throttled
            };
          })}
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
