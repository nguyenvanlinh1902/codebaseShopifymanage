import React, {useMemo} from 'react';
import {
  Card,
  Text,
  Banner,
  Button,
  InlineStack,
  BlockStack,
  SkeletonBodyText
} from '@shopify/polaris';
import SearchableChoiceList from '../../components/searchable-choice-list';

export default function StoreSelection({
  stores,
  storesLoading,
  selectedStoreIds,
  onStoreSelectionChange,
  selectedThemeId,
  savedThemes,
  checking,
  applying,
  onCheck,
  onApply
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
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Select Stores
        </Text>
        {storesLoading ? (
          <SkeletonBodyText lines={4} />
        ) : stores.length === 0 ? (
          <Banner tone="warning">No stores found. Please add stores first.</Banner>
        ) : (
          <SearchableChoiceList
            title="Select stores to check/setup"
            choices={choices}
            selected={selectedStoreIds}
            onChange={onStoreSelectionChange}
            disabled={checking || applying}
            showSelectAll
            searchPlaceholder="Search stores..."
          />
        )}

        {selectedStoreIds.length > 0 && selectedThemeId && (
          <Banner tone="info">
            <Text as="p">
              Setup will create metafield definitions and import theme{' '}
              <strong>"{savedThemes.find(t => t.id === selectedThemeId)?.themeName}"</strong> to{' '}
              <strong>{selectedStoreIds.length} store(s)</strong>.
            </Text>
          </Banner>
        )}

        <InlineStack gap="300">
          <Button
            onClick={onCheck}
            loading={checking}
            disabled={selectedStoreIds.length === 0 || applying}
          >
            Check Stores
          </Button>
          <Button
            variant="primary"
            onClick={onApply}
            loading={applying}
            disabled={selectedStoreIds.length === 0 || checking}
          >
            Apply Setup to {selectedStoreIds.length} Store
            {selectedStoreIds.length !== 1 ? 's' : ''}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
