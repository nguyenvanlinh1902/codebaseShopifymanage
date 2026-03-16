import React from 'react';
import {InlineStack, BlockStack, Text, Select, Button, Box, TextField} from '@shopify/polaris';

const DEFAULT_PER_PAGE_OPTIONS = [
  {label: '10', value: '10'},
  {label: '20', value: '20'},
  {label: '50', value: '50'}
];

/**
 * Reusable pagination + search controls for client-side paginated lists.
 * Pairs with use-client-pagination hook.
 */
export default function PaginationControls({
  page,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  showSearch = true
}) {
  const from = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, totalItems);

  return (
    <Box padding="300">
      <BlockStack gap="300">
        {showSearch && (
          <TextField
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            clearButton
            onClearButtonClick={() => onSearchChange('')}
            autoComplete="off"
            size="slim"
          />
        )}
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text variant="bodySm" tone="subdued">
            {totalItems === 0
              ? 'No results'
              : `Showing ${from}–${to} of ${totalItems}`}
          </Text>

          <InlineStack gap="300" blockAlign="center">
            <Select
              label="Per page"
              labelInline
              options={perPageOptions}
              value={String(perPage)}
              onChange={v => onPerPageChange(Number(v))}
            />
            <Button
              size="slim"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              ←
            </Button>
            <Text as="span" variant="bodySm">
              {page} / {totalPages}
            </Text>
            <Button
              size="slim"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              →
            </Button>
          </InlineStack>
        </InlineStack>
      </BlockStack>
    </Box>
  );
}
