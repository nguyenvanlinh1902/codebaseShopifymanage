import React from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Select,
  Banner,
  SkeletonBodyText,
  EmptyState,
  IndexTable,
  Box,
  Badge
} from '@shopify/polaris';

/**
 * ProductsTableSection Component
 * Displays products using modern IndexTable with store filtering and pagination
 */
export default function ProductsTableSection({
  stores,
  products,
  loading,
  selectedStore,
  selectedProducts,
  currentPage,
  itemsPerPage,
  totalProducts,
  totalPages,
  onStoreChange,
  onProductSelect,
  onSelectAll,
  onOpenReimportModal,
  onClearSelection,
  onPageChange,
  onItemsPerPageChange
}) {
  const resourceName = {
    singular: 'product',
    plural: 'products'
  };

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      selected={selectedProducts.includes(product.id)}
      position={index}
    >
      <IndexTable.Cell>{product.title}</IndexTable.Cell>
      <IndexTable.Cell>{product.sku || '-'}</IndexTable.Cell>
      <IndexTable.Cell>{product.price ? `$${product.price}` : '-'}</IndexTable.Cell>
      <IndexTable.Cell>{product.variantCount > 1 ? product.variantCount : '1'}</IndexTable.Cell>
      <IndexTable.Cell>{product.vendor || '-'}</IndexTable.Cell>
      <IndexTable.Cell>
        {stores.find(s => s.id === product.storeId)?.name || product.storeName || '-'}
      </IndexTable.Cell>
      <IndexTable.Cell>{new Date(product.createdAt).toLocaleString()}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <InlineStack gap="300" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Imported Products
          </Text>
          {totalProducts > 0 && <Badge tone="info">{totalProducts} total</Badge>}
        </InlineStack>
        {selectedProducts.length > 0 && (
          <Button onClick={onOpenReimportModal} variant="primary">
            Import {selectedProducts.length} Selected
          </Button>
        )}
      </InlineStack>

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
          heading="No products yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Import products from CSV to see them here.</p>
        </EmptyState>
      ) : (
        <>
          <IndexTable
            resourceName={resourceName}
            itemCount={products.length}
            selectedItemsCount={
              selectedProducts.length === products.length ? 'All' : selectedProducts.length
            }
            onSelectionChange={(selectionType, isSelecting, selection) => {
              if (selectionType === 'all') {
                onSelectAll();
              } else if (selectionType === 'single') {
                onProductSelect(selection, isSelecting);
              } else if (selectionType === 'page') {
                products.forEach(product => {
                  if (isSelecting && !selectedProducts.includes(product.id)) {
                    onProductSelect(product.id, true);
                  } else if (!isSelecting && selectedProducts.includes(product.id)) {
                    onProductSelect(product.id, false);
                  }
                });
              }
            }}
            headings={[
              { title: 'Title' },
              { title: 'SKU' },
              { title: 'Price' },
              { title: 'Variants' },
              { title: 'Vendor' },
              { title: 'Store' },
              { title: 'Imported At' }
            ]}
          >
            {rowMarkup}
          </IndexTable>

          {/* Backend Pagination */}
          {totalProducts > 0 && (
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text as="p" variant="bodySm" tone="subdued">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                </Text>

                <InlineStack gap="300" blockAlign="center">
                  <Select
                    label="Per page"
                    labelInline
                    options={[
                      { label: '50', value: '50' },
                      { label: '100', value: '100' },
                      { label: '200', value: '200' }
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
