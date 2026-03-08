import React from 'react';
import {Select, Button, InlineStack, BlockStack, Text, Banner, Box} from '@shopify/polaris';
import PreviewDataTable from './PreviewDataTable';

/**
 * Google Sheet Import Tab
 * Store selector is at page level — this tab handles sheet/tab selection + preview/import.
 */
export default function GoogleSheetImportTab({
  sheetOptions,
  selectedSheet,
  onSheetChange,
  sheetTabOptions,
  selectedSheetTab,
  onSheetTabChange,
  previewLoading,
  onPreview,
  importing,
  onImport,
  previewData,
  canImport
}) {
  const noSheets = sheetOptions.length === 0;

  return (
    <BlockStack gap="400">
      {noSheets ? (
        <Banner tone="warning">
          No Google Sheets connected. Go to the <strong>Google Sheets</strong> page to connect a sheet first.
        </Banner>
      ) : (
        <>
          <InlineStack gap="400" wrap>
            <div style={{minWidth: '240px', flex: 2}}>
              <Select
                label="Google Sheet"
                options={[{label: 'Choose a sheet', value: ''}, ...sheetOptions]}
                value={selectedSheet}
                onChange={onSheetChange}
              />
            </div>

            {selectedSheet && (
              <div style={{minWidth: '200px', flex: 1}}>
                <Select
                  label="Tab"
                  options={[{label: 'Choose a tab', value: ''}, ...sheetTabOptions]}
                  value={selectedSheetTab}
                  onChange={onSheetTabChange}
                  disabled={sheetTabOptions.length === 0}
                />
              </div>
            )}
          </InlineStack>

          {selectedSheet && selectedSheetTab && (
            <InlineStack gap="200">
              <Button onClick={onPreview} loading={previewLoading}>
                Preview Data
              </Button>
              <Button
                variant="primary"
                onClick={onImport}
                loading={importing}
                disabled={!canImport || !selectedSheetTab}
              >
                Import Tracking
              </Button>
              {!canImport && (
                <Text tone="subdued" variant="bodySm">Select a store above to import</Text>
              )}
            </InlineStack>
          )}
        </>
      )}

      {previewData && (
        <Box paddingBlockStart="200">
          <PreviewDataTable previewData={previewData} />
        </Box>
      )}
    </BlockStack>
  );
}
