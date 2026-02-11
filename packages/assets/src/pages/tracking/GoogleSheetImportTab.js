import React from 'react';
import {Select, Button, InlineStack} from '@shopify/polaris';
import PreviewDataTable from './PreviewDataTable';

/**
 * Google Sheet Import Tab Component
 * Handles selection of store, sheet, tab, and preview/import actions
 */
export default function GoogleSheetImportTab({
  storeOptions,
  selectedStore,
  onStoreChange,
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
  previewData
}) {
  return (
    <div style={{marginTop: '16px'}}>
      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Store"
          options={storeOptions}
          value={selectedStore}
          onChange={onStoreChange}
          placeholder="Choose a store"
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Google Sheet"
          options={sheetOptions}
          value={selectedSheet}
          onChange={onSheetChange}
          placeholder="Choose a sheet"
          disabled={sheetOptions.length === 0}
          helpText={
            sheetOptions.length === 0
              ? 'No sheets connected. Go to Google Sheets page to connect.'
              : ''
          }
        />
      </div>

      {selectedSheet && (
        <div style={{marginBottom: '16px'}}>
          <Select
            label="Select Tab"
            options={sheetTabOptions}
            value={selectedSheetTab}
            onChange={onSheetTabChange}
            placeholder="Choose a tab"
            disabled={sheetTabOptions.length === 0}
          />
        </div>
      )}

      {selectedSheet && selectedSheetTab && (
        <div style={{marginBottom: '16px'}}>
          <InlineStack gap="200">
            <Button onClick={onPreview} loading={previewLoading} disabled={!selectedSheetTab}>
              Preview Data
            </Button>
            <Button
              variant="primary"
              onClick={onImport}
              loading={importing}
              disabled={!selectedStore || !selectedSheetTab}
            >
              Import Tracking
            </Button>
          </InlineStack>
        </div>
      )}

      <PreviewDataTable previewData={previewData} />
    </div>
  );
}
