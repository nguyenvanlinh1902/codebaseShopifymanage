import React, {useState, useEffect, useCallback} from 'react';
import {
  Page, Layout, Card, Tabs, Banner, Select, InlineStack, BlockStack, Text, Box, Badge
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useStores} from '../context/store-context';
import GoogleSheetImportTab from './tracking/GoogleSheetImportTab';
import ExcelUploadTab from './tracking/ExcelUploadTab';
import ImportHistoryTable from './tracking/ImportHistoryTable';
import ImportDetailsModal from './tracking/ImportDetailsModal';

/**
 * Tracking Import Page
 * Supports Google Sheet and Excel import with group-based store filtering.
 */
export default function Tracking() {
  const [selectedTab, setSelectedTab] = useState(0);

  // Stores & groups
  const {stores, groups, loading} = useStores();
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  // History
  const [importHistory, setImportHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Feedback
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Google Sheet state
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Excel state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const tabs = [
    {id: 'google-sheet', content: 'Google Sheet'},
    {id: 'excel-upload', content: 'Excel Upload'}
  ];

  // Auto-select first store when stores load
  useEffect(() => {
    if (stores.length > 0 && !selectedStore) setSelectedStore(stores[0].id);
  }, [stores]);
  useEffect(() => { if (selectedStore) fetchImportHistory(); }, [selectedStore]);
  useEffect(() => { if (selectedTab === 0) fetchSheets(); }, [selectedTab]);
  useEffect(() => {
    if (selectedSheet) { fetchSheetTabs(); setSelectedSheetTab(''); setPreviewData(null); }
  }, [selectedSheet]);
  useEffect(() => { setPreviewData(null); }, [selectedSheetTab]);

  // Auto-refresh while jobs are processing
  useEffect(() => {
    const hasProcessing = importHistory.some(i => i.status === 'processing' || i.status === 'pending');
    if (!hasProcessing) return;
    const id = setInterval(fetchImportHistory, 3000);
    return () => clearInterval(id);
  }, [importHistory]);

  const fetchSheets = async () => {
    try {
      const res = await api('/api/sheets?limit=50');
      const data = await res.json();
      if (data.success) setSheets(data.data);
    } catch {}
  };

  const fetchSheetTabs = async () => {
    try {
      const res = await api(`/api/sheets/${selectedSheet}/tabs`);
      const data = await res.json();
      if (data.success) setSheetTabs(data.data);
    } catch {}
  };

  const fetchImportHistory = async () => {
    try {
      const url = selectedStore
        ? `/api/tracking/import-history?storeId=${selectedStore}`
        : '/api/tracking/import-history';
      const res = await api(url);
      const data = await res.json();
      if (data.success) setImportHistory(data.data);
    } catch {}
  };

  const handlePreviewSheet = async () => {
    try {
      setPreviewLoading(true);
      setError(null);
      const res = await api(
        `/api/tracking/preview-sheet?sheetId=${selectedSheet}&tabName=${encodeURIComponent(selectedSheetTab)}`
      );
      const data = await res.json();
      if (data.success) setPreviewData(data.data);
      else setError(data.error || 'Failed to preview');
    } catch { setError('Failed to preview sheet data'); }
    finally { setPreviewLoading(false); }
  };

  const handleImportFromSheet = async () => {
    if (!selectedStore) { setError('Please select a store first'); return; }
    try {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api('/api/tracking/import-from-sheet', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeId: selectedStore, sheetId: selectedSheet, tabName: selectedSheetTab})
      });
      const data = await res.json();
      if (data.success) { setSuccessMessage(data.message); setPreviewData(null); fetchImportHistory(); }
      else setError(data.error || 'Failed to import from sheet');
    } catch { setError('Failed to import from sheet'); }
    finally { setImporting(false); }
  };

  const handleDropZoneDrop = useCallback((_drop, accepted) => {
    setFile(accepted[0]);
    setError(null);
  }, []);

  const handleUpload = async () => {
    if (!selectedStore) { setError('Please select a store first'); return; }
    if (!file) { setError('Please upload an Excel file first'); return; }
    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);
      const reader = new FileReader();
      reader.onload = async e => {
        const res = await api('/api/tracking/upload-excel', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({storeId: selectedStore, excelBuffer: e.target.result.split(',')[1], fileName: file.name})
        });
        const data = await res.json();
        if (data.success) { setSuccessMessage(data.message); setFile(null); fetchImportHistory(); }
        else setError(data.error || 'Failed to upload file');
        setUploading(false);
      };
      reader.onerror = () => { setError('Failed to read file'); setUploading(false); };
      reader.readAsDataURL(file);
    } catch { setError('Failed to upload file'); setUploading(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api('/api/tracking/template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'tracking-import-template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { setError('Failed to download template'); }
  };

  // Filter stores by selected group
  const visibleStores = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
  const storeOptions = [
    {label: 'Select store', value: ''},
    ...visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];
  const sheetOptions = sheets.map(s => ({label: s.title || s.name || s.spreadsheetId, value: s.id}));
  const sheetTabOptions = sheetTabs.map(t => ({label: t.title, value: t.title}));

  const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || '';
  const selectedGroupName = groups.find(g => g.id === groupFilter)?.name || '';

  return (
    <Page title="Tracking Import" subtitle="Import tracking numbers from Google Sheet or Excel">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Banner>
          </Layout.Section>
        )}

        {/* Store + Group selector — shared across all tabs */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" fontWeight="semibold">Target Store</Text>
              <InlineStack gap="400" wrap>
                {groups.length > 0 && (
                  <div style={{minWidth: '200px', flex: 1}}>
                    <Select
                      label="Filter by group"
                      options={[{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))]}
                      value={groupFilter}
                      onChange={v => { setGroupFilter(v); setSelectedStore(''); }}
                    />
                  </div>
                )}
                <div style={{minWidth: '240px', flex: 2}}>
                  <Select
                    label="Store"
                    options={storeOptions}
                    value={selectedStore}
                    onChange={setSelectedStore}
                    disabled={loading}
                  />
                </div>
              </InlineStack>
              {(selectedGroupName || selectedStoreName) && (
                <InlineStack gap="200">
                  {selectedGroupName && <Badge tone="info">{selectedGroupName}</Badge>}
                  {selectedStoreName && <Badge>{selectedStoreName}</Badge>}
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Import method tabs */}
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={i => { setSelectedTab(i); setError(null); setSuccessMessage(null); }}>
              <Box padding="400">
                {selectedTab === 0 ? (
                  <GoogleSheetImportTab
                    sheetOptions={sheetOptions}
                    selectedSheet={selectedSheet}
                    onSheetChange={setSelectedSheet}
                    sheetTabOptions={sheetTabOptions}
                    selectedSheetTab={selectedSheetTab}
                    onSheetTabChange={setSelectedSheetTab}
                    previewLoading={previewLoading}
                    onPreview={handlePreviewSheet}
                    importing={importing}
                    onImport={handleImportFromSheet}
                    previewData={previewData}
                    canImport={!!selectedStore}
                  />
                ) : (
                  <ExcelUploadTab
                    file={file}
                    uploading={uploading}
                    onDropZoneDrop={handleDropZoneDrop}
                    onUpload={handleUpload}
                    onDownloadTemplate={handleDownloadTemplate}
                    onFileRemove={() => setFile(null)}
                    canUpload={!!selectedStore}
                  />
                )}
              </Box>
            </Tabs>
          </Card>
        </Layout.Section>

        {/* Import history */}
        <Layout.Section>
          <ImportHistoryTable
            importHistory={importHistory}
            onViewDetails={imp => { setSelectedImport(imp); setShowDetailsModal(true); }}
            onRefresh={fetchImportHistory}
          />
        </Layout.Section>
      </Layout>

      <ImportDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        selectedImport={selectedImport}
      />
    </Page>
  );
}
