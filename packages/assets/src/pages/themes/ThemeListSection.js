import React from 'react';
import {
  Card,
  Select,
  IndexTable,
  Button,
  SkeletonBodyText,
  EmptyState,
  Badge,
  InlineStack,
  Text,
  BlockStack,
  Spinner
} from '@shopify/polaris';
import {RefreshIcon} from '@shopify/polaris-icons';

export default function ThemeListSection({
  storeOptions,
  selectedStoreId,
  setSelectedStoreId,
  storesLoading,
  loadThemes,
  themesLoading,
  themes,
  errorMsg,
  handlePublish,
  setConfirmDelete,
  actionLoading,
  roleBadge
}) {
  const rowMarkup = themes.map((theme, index) => (
    <IndexTable.Row id={String(theme.id)} key={theme.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">
          {theme.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{roleBadge(theme.role)}</IndexTable.Cell>
      <IndexTable.Cell>
        {theme.processing ? (
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text tone="subdued">Processing...</Text>
          </InlineStack>
        ) : (
          <Badge tone="success">Ready</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {theme.updated_at ? new Date(theme.updated_at).toLocaleDateString() : '-'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {theme.role !== 'main' && !theme.processing && (
            <Button
              size="slim"
              onClick={() => handlePublish(theme.id)}
              loading={actionLoading === theme.id}
            >
              Publish
            </Button>
          )}
          {theme.role !== 'main' && (
            <Button
              size="slim"
              tone="critical"
              onClick={() => setConfirmDelete(theme)}
              loading={actionLoading === theme.id}
            >
              Delete
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="end">
          <div style={{minWidth: '300px', flex: 1}}>
            <Select
              label="View Themes for Store"
              options={storeOptions}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
              disabled={storesLoading}
            />
          </div>
          <Button icon={RefreshIcon} onClick={loadThemes} disabled={!selectedStoreId}>
            Refresh
          </Button>
        </InlineStack>

        {themesLoading ? (
          <SkeletonBodyText lines={5} />
        ) : !selectedStoreId ? (
          <EmptyState heading="Select a store" image="">
            <p>Choose a store to view its themes.</p>
          </EmptyState>
        ) : themes.length === 0 && !errorMsg ? (
          <EmptyState heading="No themes found" image="">
            <p>This store has no themes, or the access token does not have theme permissions.</p>
          </EmptyState>
        ) : themes.length > 0 ? (
          <IndexTable
            itemCount={themes.length}
            headings={[
              {title: 'Name'},
              {title: 'Role'},
              {title: 'Status'},
              {title: 'Updated'},
              {title: 'Actions'}
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        ) : null}
      </BlockStack>
    </Card>
  );
}
