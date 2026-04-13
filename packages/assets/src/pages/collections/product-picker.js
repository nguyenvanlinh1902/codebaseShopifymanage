import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Button,
  Spinner,
  Checkbox,
  Thumbnail,
  Modal
} from '@shopify/polaris';
import {SearchIcon, XIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

export default function ProductPicker({selectedProducts, onChange, storeId}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pendingSelection, setPendingSelection] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!storeId) return;
    searchProducts(debouncedQuery);
  }, [debouncedQuery, storeId, modalOpen]);

  const searchProducts = useCallback(
    async query => {
      try {
        setSearching(true);
        const params = new URLSearchParams({storeId, query: query || ''});
        const res = await api(`/api/collections/search-products?${params}`);
        const result = await res.json();
        if (result.success) {
          setSearchResults(result.data?.products || []);
        }
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setSearching(false);
      }
    },
    [storeId]
  );

  const openModal = () => {
    setPendingSelection([...selectedProducts]);
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
    setModalOpen(true);
  };

  const handleConfirm = () => {
    onChange(pendingSelection);
    setModalOpen(false);
  };

  const isPendingSelected = id => pendingSelection.some(p => p.id === id);

  const handleToggle = product => {
    if (isPendingSelected(product.id)) {
      setPendingSelection(prev => prev.filter(p => p.id !== product.id));
    } else {
      setPendingSelection(prev => [
        ...prev,
        {id: product.id, title: product.title, image: product.featuredImage?.url || ''}
      ]);
    }
  };

  const handleRemove = id => {
    onChange(selectedProducts.filter(p => p.id !== id));
  };

  return (
    <BlockStack gap="400">
      <Button onClick={openModal} fullWidth>
        Browse products
      </Button>

      {selectedProducts.length === 0 && (
        <Text as="p" tone="subdued" variant="bodySm">
          No products added to this collection yet.
        </Text>
      )}

      {selectedProducts.length > 0 && (
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" fontWeight="medium">
            {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
          </Text>
          {selectedProducts.map(product => (
            <InlineStack key={product.id} gap="300" blockAlign="center" align="space-between">
              <InlineStack gap="300" blockAlign="center">
                <Thumbnail source={product.image || ''} alt={product.title} size="small" />
                <Text as="span" variant="bodySm">
                  {product.title}
                </Text>
              </InlineStack>
              <Button
                icon={XIcon}
                variant="plain"
                onClick={() => handleRemove(product.id)}
                accessibilityLabel={`Remove ${product.title}`}
              />
            </InlineStack>
          ))}
        </BlockStack>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add products"
        primaryAction={{content: 'Add', onAction: handleConfirm}}
        secondaryActions={[{content: 'Cancel', onAction: () => setModalOpen(false)}]}
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Search products"
              labelHidden
              placeholder="Search products"
              value={searchQuery}
              onChange={setSearchQuery}
              prefix={<SearchIcon />}
              clearButton
              onClearButtonClick={() => setSearchQuery('')}
              autoComplete="off"
              autoFocus
            />

            {searching && (
              <InlineStack align="center">
                <Spinner size="small" />
              </InlineStack>
            )}

            {!searching && searchResults.length > 0 && (
              <BlockStack gap="100">
                {searchResults.map(product => (
                  <div
                    key={product.id}
                    onClick={() => handleToggle(product)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isPendingSelected(product.id) ? '#f1f8ff' : 'transparent'
                    }}
                  >
                    <Checkbox
                      label=""
                      labelHidden
                      checked={isPendingSelected(product.id)}
                      onChange={() => handleToggle(product)}
                    />
                    <Thumbnail
                      source={product.featuredImage?.url || ''}
                      alt={product.title}
                      size="small"
                    />
                    <Text as="span" variant="bodySm">
                      {product.title}
                    </Text>
                  </div>
                ))}
              </BlockStack>
            )}

            {!searching && debouncedQuery && searchResults.length === 0 && (
              <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                No products found for &quot;{debouncedQuery}&quot;
              </Text>
            )}

            {!debouncedQuery && !searching && searchResults.length === 0 && (
              <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                Search for products to add to this collection.
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}

ProductPicker.propTypes = {
  selectedProducts: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  storeId: PropTypes.string
};
