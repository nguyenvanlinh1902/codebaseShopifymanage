import React from 'react';
import {InlineStack, Text, Pagination} from '@shopify/polaris';

const PAGE_LIMIT = 10;

/**
 * Pagination component for stores list
 */
export default function StoresPagination({page, total, totalPages, onPageChange}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div style={{padding: '16px', borderTop: '1px solid #e1e3e5'}}>
      <InlineStack align="center" blockAlign="center" gap="400">
        <Text as="span" tone="subdued">
          {(page - 1) * PAGE_LIMIT + 1}-{Math.min(page * PAGE_LIMIT, total)} of {total}
        </Text>
        <Pagination
          hasPrevious={page > 1}
          hasNext={page < totalPages}
          onPrevious={() => onPageChange(page - 1)}
          onNext={() => onPageChange(page + 1)}
        />
      </InlineStack>
    </div>
  );
}
