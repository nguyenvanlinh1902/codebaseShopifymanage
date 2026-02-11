import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Card, Tabs, Banner, SkeletonBodyText} from '@shopify/polaris';
import {api} from '../helpers/api';
import GoogleSheetImportTab from './tracking/GoogleSheetImportTab';
import ExcelUploadTab from './tracking/ExcelUploadTab';
import ImportHistoryTable from './tracking/ImportHistoryTable';
import ImportDetailsModal from './tracking/ImportDetailsModal';

/**
 * Tracking Import Page
 * Two modes: Google Sheet import & Excel file upload
 */
export default function Tracking() {
  // Shared state
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(true);
  const [importHistory, setImportHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchImportHistory();
    }
  }, [selectedStore]);

  // Fetch sheets when tab is Google Sheet
  useEffect(() => {
    if (selectedTab === 0) {
      fetchSheets();
    }
  }, [selectedTab]);

  // Fetch sheet tabs when sheet selected
  useEffect(() => {
    if (selectedSheet) {
      fetchSheetTabs();
      setSelectedSheetTab('');
      setPreviewData(null);
    }
  }, [selectedSheet]);

  // Clear preview when tab changes
  useEffect(() => {
    setPreviewData(null);
  }, [selectedSheetTab]);

  // Auto-refresh import history while there are processing jobs
  useEffect(() => {
    const hasProcessing = importHistory.some(
      imp => imp.status === 'processing' || imp.status === 'pending'
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchImportHistory();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [importHistory]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api('/api/stores');
      const result = await response.json();

      if (result.success) {
        setStores(result.data);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchSheets = async () => {
    try {
      const response = await api('/api/sheets?limit=50');
      const result = await response.json();

      if (result.success) {
        setSheets(result.data);
      }
    } catch (err) {
      console.error('Error fetching sheets:', err);
    }
  };

  const fetchSheetTabs = async () => {
    try {
      const response = await api(`/api/sheets/${selectedSheet}/tabs`);
      const result = await response.json();

      if (result.success) {
        setSheetTabs(result.data);
      }
    } catch (err) {
      console.error('Error fetching sheet tabs:', err);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const url = selectedStore
        ? `/api/tracking/import-history?storeId=${selectedStore}`
        : '/api/tracking/import-history';

      const response = await api(url);
      const result = await response.json();

      if (result.success) {
        setImportHistory(result.data);
      }
    } catch (err) {
      console.error('Error fetching import history:', err);
    }
  };

  // ===== Google Sheet handlers =====

  const handlePreviewSheet = async () => {
    try {
      setPreviewLoading(true);
      setError(null);

      const response = await api(
        `/api/tracking/preview-sheet?sheetId=${selectedSheet}&tabName=${encodeURIComponent(
          selectedSheetTab
        )}`
      );
      const result = await response.json();

      if (result.success) {
        setPreviewData(result.data);
      } else {
        setError(result.error || 'Failed to preview sheet data');
      }
    } catch (err) {
      console.error('Error previewing sheet:', err);
      setError('Failed to preview sheet data');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImportFromSheet = async () => {
    if (!selectedStore) {
      setError('Please select a store first');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);

      const response = await api('/api/tracking/import-from-sheet', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storeId: selectedStore,
          sheetId: selectedSheet,
          tabName: selectedSheetTab
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message);
        setPreviewData(null);
        fetchImportHistory();
      } else {
        setError(result.error || 'Failed to import from sheet');
      }
    } catch (err) {
      console.error('Error importing from sheet:', err);
      setError('Failed to import from sheet');
    } finally {
      setImporting(false);
    }
  };

  // ===== Excel handlers =====

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleUpload = async () => {
    if (!selectedStore) {
      setError('Please select a store first');
      return;
    }

    if (!file) {
      setError('Please upload an Excel file first');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

      const reader = new FileReader();
      reader.onload = async e => {
        const base64Data = e.target.result.split(',')[1];

        const response = await api('/api/tracking/upload-excel', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            storeId: selectedStore,
            excelBuffer: base64Data,
            fileName: file.name
          })
        });

        const result = await response.json();

        if (result.success) {
          setSuccessMessage(result.message);
          setFile(null);
          fetchImportHistory();
        } else {
          setError(result.error || 'Failed to upload file');
        }

        setUploading(false);
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file');
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api('/api/tracking/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tracking-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading template:', err);
      setError('Failed to download template');
    }
  };

  const handleViewDetails = async importJob => {
    setSelectedImport(importJob);
    setShowDetailsModal(true);
  };

  // ===== Render helpers =====

  const storeOptions = stores.map(store => ({
    label: store.name,
    value: store.id
  }));

  const sheetOptions = sheets.map(s => ({
    label: s.title || s.name || s.spreadsheetId,
    value: s.id
  }));

  const sheetTabOptions = sheetTabs.map(t => ({
    label: t.title,
    value: t.title
  }));

  return (
    <Page
      title="Tracking Import"
      subtitle="Import tracking numbers from Google Sheet or Excel file"
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <div style={{padding: '16px'}}>
                {loading ? (
                  <SkeletonBodyText lines={5} />
                ) : selectedTab === 0 ? (
                  <GoogleSheetImportTab
                    storeOptions={storeOptions}
                    selectedStore={selectedStore}
                    onStoreChange={setSelectedStore}
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
                  />
                ) : (
                  <ExcelUploadTab
                    storeOptions={storeOptions}
                    selectedStore={selectedStore}
                    onStoreChange={setSelectedStore}
                    file={file}
                    uploading={uploading}
                    onDropZoneDrop={handleDropZoneDrop}
                    onUpload={handleUpload}
                    onDownloadTemplate={handleDownloadTemplate}
                    onFileRemove={() => setFile(null)}
                  />
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <ImportHistoryTable importHistory={importHistory} onViewDetails={handleViewDetails} />
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
