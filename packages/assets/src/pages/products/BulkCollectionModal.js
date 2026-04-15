import React, {useState, useEffect, useCallback} from 'react';
import {Modal, TextField, ResourceList, ResourceItem, Text, BlockStack, SkeletonBodyText, InlineStack} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Modal for adding/removing selected products to/from a collection.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {'add'|'remove'} props.mode
 * @param {string} props.storeId
 * @param {number} props.productCount
 * @param {boolean} props.loading
 * @param {function} props.onClose
 * @param {function} props.onSubmit - called with collectionId
 */
export default function BulkCollectionModal({open, mode, storeId, productCount, loading, onClose, onSubmit}) {
  const [search, setSearch] = useState('');
  const [collections, setCollections] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchCollections = useCallback(async (query) => {
    if (!storeId) return;
    try {
      setFetching(true);
      const params = new URLSearchParams({storeId});
      if (query) params.append('query', query);
      const res = await api(`/api/shopify-products/collections?${params}`);
      const result = await res.json();
      if (result.success) setCollections(result.data || []);
    } catch {
      setCollections([]);
    } finally {
      setFetching(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSearch('');
    fetchCollections('');
  }, [open, fetchCollections]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchCollections(search), 300);
    return () => clearTimeout(timer);
  }, [search, open, fetchCollections]);

  const title = mode === 'add' ? 'Add to collection' : 'Remove from collection';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: title,
        onAction: () => onSubmit(selected),
        loading,
        disabled: !selected
      }}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="bodySm" tone="subdued">
            {mode === 'add' ? 'Add' : 'Remove'} {productCount} product(s) {mode === 'add' ? 'to' : 'from'} a collection
          </Text>
          <TextField
            label="Search collections"
            labelHidden
            value={search}
            onChange={setSearch}
            placeholder="Search collections"
            autoComplete="off"
          />
          {fetching ? (
            <SkeletonBodyText lines={5} />
          ) : (
            <ResourceList
              resourceName={{singular: 'collection', plural: 'collections'}}
              items={collections}
              renderItem={(item) => (
                <ResourceItem
                  id={item.id}
                  onClick={() => setSelected(item.id)}
                  shortcutActions={[]}
                >
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid var(--p-color-border)',
                      background: selected === item.id ? 'var(--p-color-bg-fill-brand)' : 'transparent'
                    }} />
                    <Text fontWeight={selected === item.id ? 'semibold' : 'regular'}>
                      {item.title}
                    </Text>
                    <Text tone="subdued" variant="bodySm">
                      {item.productsCount != null ? `${item.productsCount} products` : ''}
                    </Text>
                  </InlineStack>
                </ResourceItem>
              )}
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
