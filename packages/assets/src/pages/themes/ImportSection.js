import React from 'react';
import {
  Card,
  BlockStack,
  Text,
  DropZone,
  TextField,
  ChoiceList,
  Banner,
  InlineStack,
  Button
} from '@shopify/polaris';

export default function ImportSection({
  themeName,
  setThemeName,
  themeFile,
  setThemeFile,
  selectedImportStores,
  setSelectedImportStores,
  stores,
  importing,
  handleImport,
  handleDropZone
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Import Theme
        </Text>

        <DropZone accept=".zip" type="file" onDrop={handleDropZone} allowMultiple={false}>
          {themeFile ? (
            <BlockStack gap="200" inlineAlign="center">
              <Text variant="bodyMd" fontWeight="bold">
                {themeFile.name}
              </Text>
              <Text tone="subdued">{(themeFile.size / 1024 / 1024).toFixed(2)} MB</Text>
              <Button
                size="slim"
                onClick={e => {
                  e.stopPropagation();
                  setThemeFile(null);
                }}
              >
                Remove
              </Button>
            </BlockStack>
          ) : (
            <DropZone.FileUpload actionHint="Accepts .zip files" />
          )}
        </DropZone>

        <TextField
          label="Theme Name"
          value={themeName}
          onChange={setThemeName}
          placeholder="e.g. Dawn Custom"
          autoComplete="off"
        />

        <ChoiceList
          title="Import to stores"
          allowMultiple
          choices={stores.map(store => ({
            label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
            value: store.id
          }))}
          selected={selectedImportStores}
          onChange={setSelectedImportStores}
          disabled={importing}
        />

        {selectedImportStores.length > 0 && themeName && themeFile && (
          <Banner tone="info">
            <Text as="p">
              Theme <strong>"{themeName}"</strong> will be imported to{' '}
              <strong>{selectedImportStores.length} store(s)</strong>.
            </Text>
          </Banner>
        )}

        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={handleImport}
            loading={importing}
            disabled={!themeName || !themeFile || selectedImportStores.length === 0}
          >
            Import to {selectedImportStores.length || 0} Store
            {selectedImportStores.length !== 1 ? 's' : ''}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
