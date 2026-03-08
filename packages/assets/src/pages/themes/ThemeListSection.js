import React from 'react';
import {
  Select,
  Button,
  SkeletonBodyText,
  Badge,
  InlineStack,
  Text,
  BlockStack,
  Spinner,
  Box,
  Divider
} from '@shopify/polaris';
import {RefreshIcon, StarIcon} from '@shopify/polaris-icons';

function roleBadge(role) {
  switch (role) {
    case 'main': return <Badge tone="success">Live</Badge>;
    case 'unpublished': return <Badge tone="attention">Unpublished</Badge>;
    case 'demo': return <Badge tone="warning">Demo</Badge>;
    case 'development': return <Badge tone="info">Development</Badge>;
    default: return <Badge>{role}</Badge>;
  }
}

function ThemeCard({theme, onPublish, onDelete, actionLoading}) {
  const isMain = theme.role === 'main';
  const isLoading = actionLoading === theme.id;

  return (
    <Box
      background={isMain ? 'bg-surface-success' : 'bg-surface'}
      borderWidth="025"
      borderColor={isMain ? 'border-success' : 'border'}
      borderRadius="200"
      padding="400"
    >
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <InlineStack gap="300" blockAlign="center">
          {isMain && <StarIcon style={{color: 'var(--p-color-icon-success)', width: 20, height: 20}} />}
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodyMd" fontWeight={isMain ? 'bold' : 'medium'}>
                {theme.name}
              </Text>
              {roleBadge(theme.role)}
              {theme.processing && (
                <InlineStack gap="100" blockAlign="center">
                  <Spinner size="small" />
                  <Text tone="subdued" variant="bodySm">Processing...</Text>
                </InlineStack>
              )}
            </InlineStack>
            <Text tone="subdued" variant="bodySm">
              Updated {theme.updated_at ? new Date(theme.updated_at).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}) : '—'}
            </Text>
          </BlockStack>
        </InlineStack>

        <InlineStack gap="200">
          {isMain ? (
            <Text tone="success" variant="bodySm" fontWeight="semibold">Currently live</Text>
          ) : (
            <>
              {!theme.processing && (
                <Button size="slim" variant="primary" onClick={() => onPublish(theme.id)} loading={isLoading}>
                  Publish
                </Button>
              )}
              <Button size="slim" tone="critical" onClick={() => onDelete(theme)} loading={isLoading} disabled={theme.processing}>
                Delete
              </Button>
            </>
          )}
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

export default function ThemeListSection({
  storeOptions,
  selectedStoreId,
  setSelectedStoreId,
  storesLoading,
  loadThemes,
  themesLoading,
  themes,
  handlePublish,
  setConfirmDelete,
  actionLoading
}) {
  const mainTheme = themes.find(t => t.role === 'main');
  const otherThemes = themes.filter(t => t.role !== 'main');

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="end">
        <div style={{minWidth: '280px', flex: 1, maxWidth: '400px'}}>
          <Select
            label="Store"
            options={storeOptions}
            value={selectedStoreId}
            onChange={setSelectedStoreId}
            disabled={storesLoading}
          />
        </div>
        <Button icon={RefreshIcon} onClick={loadThemes} disabled={!selectedStoreId || themesLoading}>
          Refresh
        </Button>
      </InlineStack>

      {themesLoading ? (
        <BlockStack gap="300">
          <SkeletonBodyText lines={2} />
          <SkeletonBodyText lines={2} />
          <SkeletonBodyText lines={2} />
        </BlockStack>
      ) : !selectedStoreId ? (
        <Box padding="800" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="200" inlineAlign="center">
            <Text tone="subdued" alignment="center">Select a store to view its themes</Text>
          </BlockStack>
        </Box>
      ) : themes.length === 0 ? (
        <Box padding="800" background="bg-surface-secondary" borderRadius="200">
          <Text tone="subdued" alignment="center">No themes found for this store</Text>
        </Box>
      ) : (
        <BlockStack gap="300">
          {/* Live theme first */}
          {mainTheme && (
            <ThemeCard
              theme={mainTheme}
              onPublish={handlePublish}
              onDelete={setConfirmDelete}
              actionLoading={actionLoading}
            />
          )}

          {/* Divider when both sections present */}
          {mainTheme && otherThemes.length > 0 && (
            <BlockStack gap="200">
              <Divider />
              <Text tone="subdued" variant="bodySm">Other themes ({otherThemes.length})</Text>
            </BlockStack>
          )}

          {/* Other themes */}
          {otherThemes.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onPublish={handlePublish}
              onDelete={setConfirmDelete}
              actionLoading={actionLoading}
            />
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}
