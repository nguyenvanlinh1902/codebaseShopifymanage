import React from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Select,
  TextField,
  Banner,
  SkeletonBodyText,
  EmptyState,
  DataTable,
  Box,
  Checkbox,
  Icon
} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';

/**
 * ProductsTableSection Component
 * Displays products table with search, filtering, and pagination
 */
export default function ProductsTableSection({
  stores,
  products,
  loading,
  selectedStore,
  selectedProducts,
  searchQuery,
  currentPage,
  itemsPerPage,
  totalProducts,
  totalPages,
  onStoreChange,
  onSearchChange,
  onClearSearch,
  onProductSelect,
  onSelectAll,
  onOpenReimportModal,
  onClearSelection,
  onPageChange,
  onItemsPerPageChange
}) {
  const storeOptions = [
    {label: 'All Stores', value: ''},
    ...stores.map(store => ({
      label: `${store.name} (${store.shopDomain})`,
      value: store.id
    }))
  ];

  const productRows = products.map(product => [
    <Checkbox
      key={`checkbox-${product.id}`}
      checked={selectedProducts.includes(product.id)}
      onChange={checked => onProductSelect(product.id, checked)}
    />,
    product.title,
    product.sku || '-',
    product.price ? `$${product.price}` : '-',
    product.vendor || '-',
    product.productType || '-',
    stores.find(s => s.id === product.storeId)?.name || product.storeName || '-',
    new Date(product.createdAt).toLocaleString()
  ]);

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <Text as="h2" variant="headingMd">
          Imported Products
        </Text>
        <InlineStack gap="200">
          {selectedProducts.length > 0 && (
            <Button onClick={onOpenReimportModal} variant="primary">
              Import {selectedProducts.length} Selected
            </Button>
          )}
          <div style={{minWidth: '250px'}}>
            <Select
              label="Filter by Store"
              labelHidden
              options={storeOptions}
              value={selectedStore}
              onChange={value => {
                onStoreChange(value);
                onClearSelection();
              }}
            />
          </div>
        </InlineStack>
      </InlineStack>

      <TextField
        label="Search"
        labelHidden
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search by title, SKU, or vendor..."
        prefix={<Icon source={SearchIcon} />}
        clearButton
        onClearButtonClick={onClearSearch}
      />

      {selectedProducts.length > 0 && (
        <Banner tone="info">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p">
              <strong>{selectedProducts.length}</strong> product
              {selectedProducts.length !== 1 ? 's' : ''} selected
            </Text>
            <Button onClick={onClearSelection} size="slim">
              Clear Selection
            </Button>
          </InlineStack>
        </Banner>
      )}

      {loading ? (
        <SkeletonBodyText lines={8} />
      ) : products.length === 0 ? (
        <EmptyState
          heading={searchQuery ? 'No products found' : 'No products yet'}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          {searchQuery ? (
            <p>Try adjusting your search query</p>
          ) : (
            <p>Import products from CSV to see them here.</p>
          )}
        </EmptyState>
      ) : (
        <>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text', 'text', 'text']}
            headings={[
              <Checkbox
                key="select-all"
                checked={selectedProducts.length === products.length && products.length > 0}
                onChange={onSelectAll}
              />,
              'Title',
              'SKU',
              'Price',
              'Vendor',
              'Type',
              'Store',
              'Imported At'
            ]}
            rows={productRows}
          />

          {/* Backend Pagination */}
          {totalProducts > 0 && (
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text as="p" variant="bodySm" tone="subdued">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                  {searchQuery && ` (filtered)`}
                </Text>

                <InlineStack gap="300" blockAlign="center">
                  <Select
                    label="Per page"
                    labelInline
                    options={[
                      {label: '5', value: '5'},
                      {label: '50', value: '50'},
                      {label: '100', value: '100'},
                      {label: '200', value: '200'}
                    ]}
                    value={String(itemsPerPage)}
                    onChange={value => onItemsPerPageChange(Number(value))}
                  />

                  <Button
                    size="slim"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    ←
                  </Button>

                  <Text as="span" variant="bodySm">
                    {currentPage} / {totalPages}
                  </Text>

                  <Button
                    size="slim"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    →
                  </Button>
                </InlineStack>
              </InlineStack>
            </Box>
          )}
        </>
      )}
    </BlockStack>
  );
}
