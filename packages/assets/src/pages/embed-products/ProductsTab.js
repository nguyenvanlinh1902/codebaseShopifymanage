import React from 'react';
import {
  Card,
  Button,
  DataTable,
  Text,
  InlineStack,
  SkeletonBodyText,
  EmptyState,
  BlockStack,
  Icon,
  TextField,
  Select,
  Badge
} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';

export default function ProductsTab({
  products,
  loading,
  searchQuery,
  onSearchChange,
  totalProducts,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  onImportClick
}) {
  const productRows = products.map(product => [
    product.title,
    product.sku || '-',
    product.price ? `$${product.price}` : '-',
    product.vendor || '-',
    product.productType || '-',
    new Date(product.createdAt).toLocaleString()
  ]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">
            Imported Products
          </Text>
          {totalProducts > 0 && <Badge>{totalProducts} total</Badge>}
        </InlineStack>

        <TextField
          label="Search"
          labelHidden
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search by title, SKU, or vendor..."
          prefix={<Icon source={SearchIcon} />}
          clearButton
          onClearButtonClick={() => onSearchChange('')}
        />

        {loading ? (
          <SkeletonBodyText lines={8} />
        ) : products.length === 0 ? (
          <EmptyState
            heading={searchQuery ? 'No products found' : 'No products yet'}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            action={{content: 'Import CSV', onAction: onImportClick}}
          >
            <Text>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Import products from CSV to see them here.'}
            </Text>
          </EmptyState>
        ) : (
          <BlockStack gap="300">
            <DataTable
              columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
              headings={['Title', 'SKU', 'Price', 'Vendor', 'Type', 'Imported At']}
              rows={productRows}
            />
            {totalProducts > 0 && (
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text variant="bodySm" tone="subdued">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                  {searchQuery && ' (filtered)'}
                </Text>
                <InlineStack gap="300" blockAlign="center">
                  <Select
                    label="Per page"
                    labelInline
                    options={[
                      {label: '50', value: '50'},
                      {label: '100', value: '100'},
                      {label: '200', value: '200'}
                    ]}
                    value={String(itemsPerPage)}
                    onChange={value => {
                      onItemsPerPageChange(Number(value));
                      onPageChange(1);
                    }}
                  />
                  <Button
                    size="slim"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    &larr;
                  </Button>
                  <Text variant="bodySm">
                    {currentPage} / {totalPages}
                  </Text>
                  <Button
                    size="slim"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    &rarr;
                  </Button>
                </InlineStack>
              </InlineStack>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
