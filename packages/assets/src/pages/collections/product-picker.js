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
  Modal,
  Badge,
  Select
} from '@shopify/polaris';
import {SearchIcon, XIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const SORT_OPTIONS = [
  {label: 'Most relevant', value: 'BEST_SELLING'},
  {label: 'Product title A-Z', value: 'ALPHA_ASC'},
  {label: 'Product title Z-A', value: 'ALPHA_DESC'},
  {label: 'Highest price', value: 'PRICE_DESC'},
  {label: 'Lowest price', value: 'PRICE_ASC'},
  {label: 'Newest', value: 'CREATED_DESC'},
  {label: 'Oldest', value: 'CREATED'},
  {label: 'Manually', value: 'MANUAL'}
];

export default function ProductPicker({selectedProducts, onChange, storeId, sortOrder, onSortChange}) {
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
        {
          id: product.id,
          title: product.title,
          status: product.status || 'ACTIVE',
          image: product.featuredImage?.url || '',
          featuredImage: product.featuredImage || null
        }
      ]);
    }
  };

  const handleRemove = id => {
    onChange(selectedProducts.filter(p => p.id !== id));
  };

  const getImageUrl = product => product.image || product.featuredImage?.url || '';

  return (
    <BlockStack gap="300">
      {/* Search + Browse + Sort row */}
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <div style={{flex: 1}}>
          <TextField
            label="Search products"
            labelHidden
            placeholder="Search products"
            prefix={<SearchIcon />}
            value=""
            readOnly
            onFocus={openModal}
            autoComplete="off"
            size="slim"
          />
        </div>
        <Button onClick={openModal}>Browse</Button>
        {onSortChange && (
          <div style={{minWidth: 180}}>
            <Select
              label="Sort"
              labelInline
              options={SORT_OPTIONS}
              value={sortOrder || 'BEST_SELLING'}
              onChange={onSortChange}
            />
          </div>
        )}
      </InlineStack>

      {selectedProducts.length === 0 && (
        <Text as="p" tone="subdued" variant="bodySm">
          No products added to this collection yet.
        </Text>
      )}

      {/* Product list — numbered, Shopify-style */}
      {selectedProducts.length > 0 && (
        <BlockStack gap="0">
          {selectedProducts.map((product, index) => (
            <div key={product.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 0',
              borderBottom: index < selectedProducts.length - 1 ? '1px solid #e3e3e3' : 'none'
            }}>
              <Text as="span" variant="bodySm" tone="subdued">
                {index + 1}.
              </Text>
              <Thumbnail source={getImageUrl(product)} alt={product.title} size="small" />
              <div style={{flex: 1}}>
                <Text as="span" variant="bodySm">{product.title}</Text>
              </div>
              <Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'DRAFT' ? 'info' : 'attention'}>
                {(product.status || 'Active').charAt(0).toUpperCase() + (product.status || 'Active').slice(1).toLowerCase()}
              </Badge>
              <Button
                icon={XIcon}
                variant="plain"
                tone="subdued"
                onClick={() => handleRemove(product.id)}
                accessibilityLabel={`Remove ${product.title}`}
              />
            </div>
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
                    <div style={{flex: 1}}>
                      <Text as="span" variant="bodySm">{product.title}</Text>
                    </div>
                    <Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'DRAFT' ? 'info' : 'attention'}>
                      {(product.status || 'Active').charAt(0).toUpperCase() + (product.status || 'Active').slice(1).toLowerCase()}
                    </Badge>
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
  storeId: PropTypes.string,
  sortOrder: PropTypes.string,
  onSortChange: PropTypes.func
};
