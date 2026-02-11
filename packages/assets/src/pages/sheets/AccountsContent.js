import React from 'react';
import PropTypes from 'prop-types';
import {
  IndexTable,
  Button,
  EmptyState,
  Text,
  InlineStack,
  Tooltip,
  Pagination,
  useIndexResourceState
} from '@shopify/polaris';
import {DeleteIcon, PlusIcon} from '@shopify/polaris-icons';
import {PAGE_LIMIT} from './constants';

/**
 * Accounts table content (IndexTable only, no IndexFilters)
 */
export default function AccountsContent({
  accounts,
  pagination,
  onAddSheet,
  onDisconnect,
  onBulkDisconnect,
  onPageChange,
  loading,
  searchValue,
  onConnectAccount
}) {
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(accounts, {resourceIDResolver: account => account.email});

  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  const resourceName = {singular: 'account', plural: 'accounts'};

  const promotedBulkActions = [
    {
      content: `Disconnect ${selectedResources.length} account(s)`,
      onAction: () => {
        onBulkDisconnect(selectedResources);
        clearSelection();
      },
      destructive: true
    }
  ];

  if (accounts.length === 0) {
    return (
      <EmptyState
        heading={searchValue ? 'No accounts found' : 'No accounts connected'}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        action={
          !searchValue && onConnectAccount
            ? {content: 'Connect Google Account', onAction: onConnectAccount}
            : undefined
        }
      >
        <p>
          {searchValue
            ? 'Try a different search term.'
            : 'Connect your Google account to browse and select spreadsheets from Google Drive.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <IndexTable
        resourceName={resourceName}
        itemCount={accounts.length}
        headings={[{title: 'Email'}, {title: 'Sheets'}, {title: 'Actions', alignment: 'center'}]}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
      >
        {accounts.map((account, index) => (
          <IndexTable.Row
            id={account.email}
            key={account.email}
            position={index}
            selected={selectedResources.includes(account.email)}
          >
            <IndexTable.Cell>
              <Text as="span" fontWeight="semibold">
                {account.email}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" tone="subdued">
                {account.sheetCount} {account.sheetCount === 1 ? 'sheet' : 'sheets'}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="200" align="center">
                <Tooltip content="Add sheet">
                  <Button
                    icon={PlusIcon}
                    variant="plain"
                    onClick={e => {
                      e.stopPropagation();
                      onAddSheet(account.email);
                    }}
                    loading={loading}
                    accessibilityLabel="Add sheet"
                  />
                </Tooltip>
                <Tooltip content="Disconnect account">
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={e => {
                      e.stopPropagation();
                      onDisconnect(account.email);
                    }}
                    accessibilityLabel="Disconnect account"
                  />
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      {totalPages > 1 && (
        <div style={{padding: '16px', borderTop: '1px solid #e1e3e5'}}>
          <InlineStack align="center" blockAlign="center" gap="400">
            <Text as="span" tone="subdued">
              {start}-{end} of {total}
            </Text>
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => onPageChange(page - 1)}
              onNext={() => onPageChange(page + 1)}
            />
          </InlineStack>
        </div>
      )}
    </>
  );
}

AccountsContent.propTypes = {
  accounts: PropTypes.array.isRequired,
  pagination: PropTypes.object.isRequired,
  onAddSheet: PropTypes.func.isRequired,
  onDisconnect: PropTypes.func.isRequired,
  onBulkDisconnect: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  searchValue: PropTypes.string,
  onConnectAccount: PropTypes.func
};
