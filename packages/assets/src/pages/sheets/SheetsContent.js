import React from 'react';
import PropTypes from 'prop-types';
import {
  IndexTable,
  Button,
  SkeletonBodyText,
  EmptyState,
  Text,
  InlineStack,
  Tooltip,
  Pagination,
  useIndexResourceState
} from '@shopify/polaris';
import {DeleteIcon, ExternalIcon} from '@shopify/polaris-icons';
import {truncateStyle, PAGE_LIMIT} from './constants';

/**
 * Sheets table content (IndexTable only, no IndexFilters)
 */
export default function SheetsContent({
  sheets,
  pagination,
  loading,
  onDelete,
  onBulkDelete,
  onPageChange,
  authenticated,
  onAuth,
  searchValue
}) {
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(sheets);

  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  const resourceName = {singular: 'sheet', plural: 'sheets'};

  const promotedBulkActions = [
    {
      content: `Delete ${selectedResources.length} sheet(s)`,
      onAction: () => {
        onBulkDelete(selectedResources);
        clearSelection();
      },
      destructive: true
    }
  ];

  if (loading) {
    return (
      <div style={{padding: '16px'}}>
        <SkeletonBodyText lines={5} />
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <EmptyState
        heading={searchValue ? 'No sheets found' : 'No sheets connected'}
        action={
          !authenticated && !searchValue
            ? {content: 'Connect Google Account', onAction: onAuth}
            : undefined
        }
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>
          {searchValue
            ? 'Try a different search term.'
            : authenticated
            ? 'Switch to the Accounts tab and use the add icon to connect a Google Sheet.'
            : 'Connect your Google account first, then add sheets from Google Drive.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <IndexTable
        resourceName={resourceName}
        itemCount={sheets.length}
        headings={[
          {title: 'Spreadsheet'},
          {title: 'Store'},
          {title: 'Google Account'},
          {title: 'Actions', alignment: 'center'}
        ]}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
      >
        {sheets.map((sheet, index) => (
          <IndexTable.Row
            id={sheet.id}
            key={sheet.id}
            position={index}
            selected={selectedResources.includes(sheet.id)}
          >
            <IndexTable.Cell>
              <Tooltip content={sheet.name}>
                <div style={truncateStyle}>
                  <Text variant="bodyMd" fontWeight="bold">
                    {sheet.name}
                  </Text>
                </div>
              </Tooltip>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" tone="subdued">{sheet.shopDomain || '\u2014'}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{sheet.googleEmail || '\u2014'}</IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="200" align="center">
                {sheet.spreadsheetId && (
                  <Tooltip content="Open in Google Sheets">
                    <Button
                      icon={ExternalIcon}
                      variant="plain"
                      onClick={e => {
                        e.stopPropagation();
                        window.open(
                          `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
                          '_blank'
                        );
                      }}
                      accessibilityLabel="Open sheet"
                    />
                  </Tooltip>
                )}
                <Tooltip content="Disconnect sheet">
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(sheet);
                    }}
                    accessibilityLabel="Disconnect"
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

SheetsContent.propTypes = {
  sheets: PropTypes.array.isRequired,
  pagination: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
  onBulkDelete: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  authenticated: PropTypes.bool,
  onAuth: PropTypes.func,
  searchValue: PropTypes.string
};
