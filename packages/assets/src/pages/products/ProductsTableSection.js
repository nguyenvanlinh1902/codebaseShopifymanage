import React from 'react';
import {
  BlockStack,
  SkeletonBodyText,
  EmptyState,
  IndexTable,
  Badge,
  Text,
  Thumbnail,
  Pagination,
  Box,
  InlineStack,
  useIndexResourceState
} from '@shopify/polaris';
import {ImageIcon} from '@shopify/polaris-icons';
import {useBreakpoints} from '@shopify/polaris';

const STATUS_TONE = {ACTIVE: 'success', DRAFT: 'info', ARCHIVED: 'subdued'};

function formatInventory(product) {
  const total = product.totalInventory ?? 0;
  const variants = product.variantsCount?.count ?? 1;
  if (variants > 1) return `${total} in stock for ${variants} variants`;
  return `${total} in stock`;
}

export default function ProductsTableSection({
  products, loading, pageInfo, onNextPage, onPrevPage, hasPrev,
  onBulkAction, onRowClick
}) {
  const {smDown} = useBreakpoints();
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(products);

  if (loading) return <SkeletonBodyText lines={10} />;

  if (products.length === 0) {
    return (
      <EmptyState heading="No products found" image="">
        <p>Select a store or adjust your search to see products.</p>
      </EmptyState>
    );
  }

  const handleBulk = (action) => {
    if (onBulkAction) onBulkAction(action, selectedResources, clearSelection);
  };

  const promotedBulkActions = [
    {content: 'Set as active', onAction: () => handleBulk('ACTIVE')},
    {content: 'Set as draft', onAction: () => handleBulk('DRAFT')}
  ];

  const bulkActions = [
    {content: 'Archive products', onAction: () => handleBulk('ARCHIVED')},
    {content: 'Delete products', destructive: true, onAction: () => handleBulk('DELETE')},
    {content: 'Add tags', onAction: () => handleBulk('ADD_TAGS')},
    {content: 'Remove tags', onAction: () => handleBulk('REMOVE_TAGS')},
    {content: 'Add to collection(s)', onAction: () => handleBulk('ADD_TO_COLLECTION')},
    {content: 'Remove from collection(s)', onAction: () => handleBulk('REMOVE_FROM_COLLECTION')}
  ];

  const rowMarkup = products.map((product, index) => {
    const status = product.status || 'ACTIVE';
    const label = status.charAt(0) + status.slice(1).toLowerCase();
    const inv = product.totalInventory ?? 0;

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
        onClick={onRowClick ? () => onRowClick(product) : undefined}
      >
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <Thumbnail
              source={product.featuredImage?.url || ImageIcon}
              alt={product.title}
              size="small"
            />
            <Text fontWeight="semibold" truncate>{product.title}</Text>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_TONE[status] || 'subdued'}>{label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text tone={inv === 0 ? 'critical' : 'success'}>
            {formatInventory(product)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{product.productType || '—'}</IndexTable.Cell>
        <IndexTable.Cell>{product.vendor || '—'}</IndexTable.Cell>
        <IndexTable.Cell>
          {(() => {
            const pubs = product.resourcePublications?.nodes || [];
            const total = product.resourcePublicationsCount?.count ?? pubs.length;
            if (total === 0) return <Text tone="subdued">—</Text>;
            const names = pubs.map(n => n.publication?.name).filter(Boolean);
            const shown = names.slice(0, 2);
            const extra = total - shown.length;
            return (
              <InlineStack gap="100" wrap>
                {shown.map(name => (
                  <Badge key={name} tone="info">{name}</Badge>
                ))}
                {extra > 0 && <Badge>{`+${extra}`}</Badge>}
              </InlineStack>
            );
          })()}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack>
      <IndexTable
        resourceName={{singular: 'product', plural: 'products'}}
        itemCount={products.length}
        selectable
        condensed={smDown}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
        bulkActions={bulkActions}
        headings={[
          {title: 'Product'},
          {title: 'Status'},
          {title: 'Inventory'},
          {title: 'Category'},
          {title: 'Vendor'},
          {title: 'Sales channels'}
        ]}
      >
        {rowMarkup}
      </IndexTable>

      {(hasPrev || pageInfo?.hasNextPage) && (
        <Box padding="400">
          <InlineStack align="center">
            <Pagination
              hasPrevious={hasPrev}
              onPrevious={onPrevPage}
              hasNext={pageInfo?.hasNextPage}
              onNext={onNextPage}
            />
          </InlineStack>
        </Box>
      )}
    </BlockStack>
  );
}
