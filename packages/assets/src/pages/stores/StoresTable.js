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
  EmptyState
} from '@shopify/polaris';
import {EditIcon} from '@shopify/polaris-icons';

/**
 * Stores list with name, domain, niche, status and edit action
 */
export default function StoresTable({stores, loading, activeSearch, nicheFilter, onEditClick}) {
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
              {store.partnerClientId && (
                <Text variant="bodySm" tone="subdued">
                  Client ID: {store.partnerClientId.slice(0, 8)}...
                  {store.installedVia ? ` (${store.installedVia})` : ''}
                </Text>
              )}
            </BlockStack>
            <InlineStack gap="300" blockAlign="center">
              <Badge tone={store.status === 'active' ? 'success' : 'warning'}>
                {store.status}
              </Badge>
              <Button
                icon={EditIcon}
                variant="plain"
                onClick={() => onEditClick(store)}
                accessibilityLabel={`Edit niche for ${store.name}`}
              />
            </InlineStack>
          </InlineStack>
        </ResourceItem>
      )}
    />
  );
}
