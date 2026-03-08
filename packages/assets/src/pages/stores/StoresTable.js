import React from 'react';
import {
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Button,
  SkeletonBodyText,
  SkeletonDisplayText,
  EmptyState
} from '@shopify/polaris';
import {EditIcon, DeleteIcon} from '@shopify/polaris-icons';

function formatBalance(balance) {
  if (!balance || !balance.amount) return null;
  const currency = balance.currency || balance.currencyCode || 'USD';
  return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format(balance.amount);
}

/**
 * Stores list with name, domain, niche, status, balance and edit action
 */
export default function StoresTable({stores, loading, activeSearch, nicheFilter, balances = {}, balancesLoading, onEditClick, onDeleteClick, groups = []}) {
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

  return (
    <ResourceList
      resourceName={{singular: 'store', plural: 'stores'}}
      items={stores}
      renderItem={store => (
        <ResourceItem id={store.id} accessibilityLabel={store.name}>
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold">
                {store.name}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {store.shopDomain}
              </Text>
              {store.niche && (
                <Text variant="bodySm" tone="subdued">
                  Niche: {store.niche}
                </Text>
              )}
              {(() => { const group = groups.find(g => g.id === store.groupId); return group ? <Badge>{group.name}</Badge> : null; })()}
              {store.partnerClientId && (
                <Text variant="bodySm" tone="subdued">
                  Client ID: {store.partnerClientId.slice(0, 8)}...
                  {store.installedVia ? ` (${store.installedVia})` : ''}
                </Text>
              )}
            </BlockStack>
            <InlineStack gap="300" blockAlign="center">
              {/* Shopify Payments balance */}
              {balancesLoading ? (
                <div style={{width: 64}}>
                  <SkeletonDisplayText size="small" />
                </div>
              ) : balances[store.id] ? (
                <Badge tone="success">{formatBalance(balances[store.id])}</Badge>
              ) : null}
              <Badge tone={store.status === 'active' ? 'success' : 'warning'}>
                {store.status}
              </Badge>
              <Button
                icon={EditIcon}
                variant="plain"
                onClick={() => onEditClick(store)}
                accessibilityLabel={`Edit niche for ${store.name}`}
              />
              <Button
                icon={DeleteIcon}
                variant="plain"
                tone="critical"
                onClick={() => onDeleteClick(store)}
                accessibilityLabel={`Delete ${store.name}`}
              />
            </InlineStack>
          </InlineStack>
        </ResourceItem>
      )}
    />
  );
}
