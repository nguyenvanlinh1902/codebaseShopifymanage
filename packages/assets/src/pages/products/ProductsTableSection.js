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
  InlineStack
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

export default function ProductsTableSection({products, loading, pageInfo, onNextPage, onPrevPage, hasPrev}) {
  const {smDown} = useBreakpoints();

  if (loading) return <SkeletonBodyText lines={10} />;

  if (products.length === 0) {
    return (
      <EmptyState heading="No products found" image="">
        <p>Select a store or adjust your search to see products.</p>
      </EmptyState>
    );
  }

  const rowMarkup = products.map((product, index) => {
    const status = product.status || 'ACTIVE';
    const label = status.charAt(0) + status.slice(1).toLowerCase();
    const inv = product.totalInventory ?? 0;

    return (
      <IndexTable.Row id={product.id} key={product.id} position={index}>
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
        headings={[
          {title: 'Product'},
          {title: 'Status'},
          {title: 'Inventory'},
          {title: 'Category'},
          {title: 'Vendor'}
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
