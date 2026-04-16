import React from 'react';
import {
  IndexTable,
  Text,
  Badge,
  InlineStack,
  Button,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';
import {EditIcon, DeleteIcon} from '@shopify/polaris-icons';

function formatBalance(balance) {
  if (!balance || !balance.amount) return null;
  const currency = balance.currency || balance.currencyCode || 'USD';
  return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(balance.amount);
}

const HEADINGS = [
  {title: 'Store'},
  {title: 'Domain'},
  {title: 'Niche'},
  {title: 'Client ID'},
  {title: 'Balance'},
  {title: 'Status'},
  {title: 'Actions', alignment: 'end'}
];

/**
 * Stores table using IndexTable for cleaner display
 */
export default function StoresTable({
  stores,
  loading,
  activeSearch,
  nicheFilter,
  balances = {},
  balancesLoading,
  onEditClick,
  onDeleteClick
}) {
  if (loading) {
    return (
      <div style={{padding: '16px'}}>
        <SkeletonBodyText lines={5} />
      </div>
    );
  }

  if (stores.length === 0) {
    if (activeSearch || nicheFilter.length > 0) {
      return (
        <EmptyState heading="No stores found" image="">
          <p>Try a different search term or filter.</p>
        </EmptyState>
      );
    }
    return (
      <EmptyState
        heading="No stores connected"
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Stores are added automatically when merchants install the app from Shopify Admin.</p>
      </EmptyState>
    );
  }

  const rowMarkup = stores.map((store, index) => {
    const balanceFormatted = formatBalance(balances[store.id]);

    return (
      <IndexTable.Row id={store.id} key={store.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold">
            {store.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued">
            {store.shopDomain}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {store.niche ? (
            <Text variant="bodySm" tone="subdued">{store.niche}</Text>
          ) : (
            <Text variant="bodySm" tone="subdued">—</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {store.partnerClientId ? (
            <Text variant="bodySm" tone="subdued">
              {store.partnerClientId.slice(0, 8)}...
              {store.installedVia ? ` (${store.installedVia})` : ''}
            </Text>
          ) : (
            <Text variant="bodySm" tone="subdued">—</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {balancesLoading ? (
            <Text variant="bodySm" tone="subdued">...</Text>
          ) : balanceFormatted ? (
            <Badge tone="success">{balanceFormatted}</Badge>
          ) : (
            <Text variant="bodySm" tone="subdued">—</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={store.status === 'active' ? 'success' : store.status === 'dead' ? 'critical' : 'warning'}>
            {store.status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" align="end">
            <Button
              icon={EditIcon}
              variant="plain"
              onClick={() => onEditClick(store)}
              accessibilityLabel={`Edit ${store.name}`}
            />
            <Button
              icon={DeleteIcon}
              variant="plain"
              tone="critical"
              onClick={() => onDeleteClick(store)}
              accessibilityLabel={`Delete ${store.name}`}
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <IndexTable
      resourceName={{singular: 'store', plural: 'stores'}}
      itemCount={stores.length}
      headings={HEADINGS}
      selectable={false}
    >
      {rowMarkup}
    </IndexTable>
  );
}
