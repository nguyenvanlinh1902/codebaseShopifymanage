import React, {useMemo} from 'react';
import {
  BlockStack,
  Text,
  DropZone,
  TextField,
  Banner,
  InlineStack,
  Box,
  Badge
} from '@shopify/polaris';
import SearchableChoiceList from '../../components/searchable-choice-list';

/**
 * Import Theme form — used inside the Import Modal.
 * When `inModal` is true, hides the standalone Import button (modal footer handles it).
 */
export default function ImportSection({
  themeName,
  setThemeName,
  themeFile,
  setThemeFile,
  selectedImportStores,
  setSelectedImportStores,
  stores,
  importing,
  handleDropZone,
  inModal = false
}) {
  const choices = useMemo(
    () =>
      stores.map(store => ({
        label: store.name || store.shopDomain,
        helpText: `${store.shopDomain}.myshopify.com`,
        value: store.id
      })),
    [stores]
  );
  return (
    <BlockStack gap="400">
      {/* File upload */}
      <BlockStack gap="200">
        <Text variant="bodyMd" fontWeight="semibold">Theme File (.zip)</Text>
        <DropZone accept=".zip" type="file" onDrop={handleDropZone} allowMultiple={false} disabled={importing}>
          {themeFile ? (
            <Box padding="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="bodyMd" fontWeight="medium">{themeFile.name}</Text>
                    <Text tone="subdued" variant="bodySm">{(themeFile.size / 1024 / 1024).toFixed(2)} MB</Text>
                  </BlockStack>
                  <Badge tone="success">Ready</Badge>
                </InlineStack>
                <button
                  onClick={e => { e.stopPropagation(); setThemeFile(null); }}
                  style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-color-text-critical)', fontSize: '13px', padding: '4px 8px'}}
                >
                  Remove
                </button>
              </InlineStack>
            </Box>
          ) : (
            <DropZone.FileUpload actionTitle="Add .zip file" actionHint="or drag and drop a Shopify theme zip" />
          )}
        </DropZone>
      </BlockStack>

      {/* Theme name */}
      <TextField
        label="Theme Name"
        value={themeName}
        onChange={setThemeName}
        placeholder="e.g. Dawn Custom"
        autoComplete="off"
        disabled={importing}
        helpText="This will be the theme name shown in Shopify admin"
      />

      {/* Store selection */}
      {stores.length === 0 ? (
        <Banner tone="warning">No stores available. Add a store first.</Banner>
      ) : (
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" fontWeight="semibold">Import to stores</Text>
            {selectedImportStores.length > 0 && (
              <Text tone="subdued" variant="bodySm">{selectedImportStores.length} selected</Text>
            )}
          </InlineStack>
          <SearchableChoiceList
            choices={choices}
            selected={selectedImportStores}
            onChange={setSelectedImportStores}
            disabled={importing}
            showSelectAll
            searchPlaceholder="Search stores..."
          />
        </BlockStack>
      )}

      {/* Summary banner */}
      {selectedImportStores.length > 0 && themeName && themeFile && (
        <Banner tone="info">
          <strong>"{themeName}"</strong> will be imported to <strong>{selectedImportStores.length} store{selectedImportStores.length !== 1 ? 's' : ''}</strong>
        </Banner>
      )}
    </BlockStack>
  );
}
