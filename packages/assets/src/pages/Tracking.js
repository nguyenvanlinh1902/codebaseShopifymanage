import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Tabs,
  Select,
  Button,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  ProgressBar,
  DropZone,
  Modal,
  InlineStack
} from '@shopify/polaris';
import {api} from '../helpers/api';

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
        `/api/tracking/preview-sheet?sheetId=${selectedSheet}&tabName=${encodeURIComponent(selectedSheetTab)}`
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

  const renderGoogleSheetTab = () => (
    <div style={{marginTop: '16px'}}>
      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Store"
          options={storeOptions}
          value={selectedStore}
          onChange={setSelectedStore}
          placeholder="Choose a store"
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Google Sheet"
          options={sheetOptions}
          value={selectedSheet}
          onChange={setSelectedSheet}
          placeholder="Choose a sheet"
          disabled={sheets.length === 0}
          helpText={sheets.length === 0 ? 'No sheets connected. Go to Google Sheets page to connect.' : ''}
        />
      </div>

      {selectedSheet && (
        <div style={{marginBottom: '16px'}}>
          <Select
            label="Select Tab"
            options={sheetTabOptions}
            value={selectedSheetTab}
            onChange={setSelectedSheetTab}
            placeholder="Choose a tab"
            disabled={sheetTabs.length === 0}
          />
        </div>
      )}

      {selectedSheet && selectedSheetTab && (
        <div style={{marginBottom: '16px'}}>
          <InlineStack gap="200">
            <Button
              onClick={handlePreviewSheet}
              loading={previewLoading}
              disabled={!selectedSheetTab}
            >
              Preview Data
            </Button>
            <Button
              variant="primary"
              onClick={handleImportFromSheet}
              loading={importing}
              disabled={!selectedStore || !selectedSheetTab}
            >
              Import Tracking
            </Button>
          </InlineStack>
        </div>
      )}

      {/* Preview table */}
      {previewData && (
        <div style={{marginTop: '16px'}}>
          <Text variant="headingSm" as="h3">
            Preview ({previewData.validCount} valid, {previewData.invalidCount} invalid of {previewData.totalRows} rows)
          </Text>
          <div
            style={{
              marginTop: '8px',
              maxHeight: '300px',
              overflow: 'auto',
              border: '1px solid #e1e3e5',
              borderRadius: '4px'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}
            >
              <thead style={{background: '#f6f6f7', position: 'sticky', top: 0}}>
                <tr>
                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>Row</th>
                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>Order #</th>
                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>Tracking Number</th>
                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>Carrier</th>
                  <th style={{padding: '8px', textAlign: 'center', borderBottom: '1px solid #e1e3e5'}}>Valid</th>
                </tr>
              </thead>
              <tbody>
                {previewData.records.map((record, idx) => (
                  <tr
                    key={idx}
                    style={{
                      background: !record.valid ? '#fff4f4' : idx % 2 === 0 ? '#fff' : '#fafbfb',
                      borderBottom: '1px solid #e1e3e5'
                    }}
                  >
                    <td style={{padding: '8px'}}>{record.row}</td>
                    <td style={{padding: '8px', fontWeight: 'bold'}}>
                      {record.data.orderNumber || record.data['Order Number'] || '-'}
                    </td>
                    <td style={{padding: '8px', fontFamily: 'monospace'}}>
                      {record.data.trackingNumber || record.data['Tracking Number'] || '-'}
                    </td>
                    <td style={{padding: '8px'}}>
                      {record.data.trackingCompany || record.data['Carrier'] || '-'}
                    </td>
                    <td style={{padding: '8px', textAlign: 'center'}}>
                      {record.valid ? (
                        <span style={{color: '#008060'}}>✅</span>
                      ) : (
                        <span title={record.errors.join(', ')} style={{color: '#d72c0d', cursor: 'help'}}>
                          ❌
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const uploadFileMarkup = file ? (
    <div style={{padding: '16px', textAlign: 'center'}}>
      <Text variant="bodyMd" as="p">
        {file.name}
      </Text>
      <Text variant="bodySm" as="p" tone="subdued">
        {(file.size / 1024).toFixed(2)} KB
      </Text>
      <div style={{marginTop: '8px'}}>
        <Button size="slim" onClick={() => setFile(null)}>
          Remove
        </Button>
      </div>
    </div>
  ) : (
    <DropZone.FileUpload actionHint="Accepts .xlsx, .xls files" />
  );

  const renderExcelTab = () => (
    <div style={{marginTop: '16px'}}>
      <div style={{marginBottom: '16px'}}>
        <Select
          label="Select Store"
          options={storeOptions}
          value={selectedStore}
          onChange={setSelectedStore}
          placeholder="Choose a store"
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <Text variant="bodyMd" as="p" fontWeight="medium">
          Upload Excel File
        </Text>
        <div style={{marginTop: '8px'}}>
          <DropZone
            onDrop={handleDropZoneDrop}
            accept=".xlsx,.xls"
            type="file"
            disabled={uploading}
          >
            {uploadFileMarkup}
          </DropZone>
        </div>
      </div>

      <div style={{display: 'flex', gap: '8px'}}>
        <Button
          variant="primary"
          fullWidth
          onClick={handleUpload}
          loading={uploading}
          disabled={!selectedStore || !file}
        >
          Upload & Process
        </Button>
        <Button onClick={handleDownloadTemplate}>Download Template</Button>
      </div>
    </div>
  );

  const importRows = importHistory.map(imp => [
    imp.fileName || 'N/A',
    imp.storeName || 'N/A',
    <Badge
      key={`status-${imp.id}`}
      tone={
        imp.status === 'completed'
          ? 'success'
          : imp.status === 'failed'
          ? 'critical'
          : imp.status === 'processing'
          ? 'info'
          : 'attention'
      }
    >
      {imp.status || 'pending'}
    </Badge>,
    imp.status === 'processing' ? (
      <div key={`progress-${imp.id}`} style={{width: '100px'}}>
        <ProgressBar
          progress={((imp.processedRecords || 0) / (imp.totalRecords || 1)) * 100}
          size="small"
        />
        <Text variant="bodySm" as="span" tone="subdued">
          {imp.processedRecords || 0}/{imp.totalRecords || 0}
        </Text>
      </div>
    ) : (
      `${imp.processedRecords || 0}/${imp.totalRecords || 0}`
    ),
    imp.status === 'completed' ? (
      <div key={`results-${imp.id}`}>
        <Text variant="bodySm" as="span" tone="success">
          {imp.successCount || 0} ok
        </Text>
        {' / '}
        <Text variant="bodySm" as="span" tone="critical">
          {imp.failedCount || 0} fail
        </Text>
      </div>
    ) : (
      '-'
    ),
    new Date(imp.createdAt).toLocaleString(),
    <Button key={`btn-${imp.id}`} size="slim" onClick={() => handleViewDetails(imp)}>
      View Details
    </Button>
  ]);

  return (
    <Page title="Tracking Import" subtitle="Import tracking numbers from Google Sheet or Excel file">
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
                  renderGoogleSheetTab()
                ) : (
                  renderExcelTab()
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{padding: '16px'}}>
              <Text variant="headingMd" as="h2">
                Import History
              </Text>
            </div>

            {importHistory.length === 0 ? (
              <div style={{padding: '40px', textAlign: 'center'}}>
                <Text variant="bodySm" as="p" tone="subdued">
                  No import history yet. Import your first tracking data to get started!
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={[
                  'Source',
                  'Store',
                  'Status',
                  'Progress',
                  'Results',
                  'Created At',
                  'Actions'
                ]}
                rows={importRows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* Details Modal */}
      <Modal
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Import Details"
        primaryAction={{
          content: 'Close',
          onAction: () => setShowDetailsModal(false)
        }}
      >
        <Modal.Section>
          {selectedImport && (
            <div>
              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Source:
                </Text>
                <Text variant="bodyMd" as="p">
                  {selectedImport.fileName}
                </Text>
              </div>

              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Store:
                </Text>
                <Text variant="bodyMd" as="p">
                  {selectedImport.storeName} ({selectedImport.shopDomain})
                </Text>
              </div>

              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Status:
                </Text>
                <Badge
                  tone={
                    selectedImport.status === 'completed'
                      ? 'success'
                      : selectedImport.status === 'failed'
                      ? 'critical'
                      : 'info'
                  }
                >
                  {selectedImport.status}
                </Badge>
              </div>

              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Records:
                </Text>
                <ul style={{marginLeft: '20px'}}>
                  <li>Total: {selectedImport.totalRecords}</li>
                  <li>Processed: {selectedImport.processedRecords || 0}</li>
                  <li>Success: {selectedImport.successCount || 0}</li>
                  <li>Failed: {selectedImport.failedCount || 0}</li>
                </ul>
              </div>

              {/* Order Tracking Details Table */}
              {selectedImport.trackingDetails && selectedImport.trackingDetails.length > 0 && (
                <div style={{marginBottom: '16px'}}>
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    Order Tracking Details:
                  </Text>
                  <div
                    style={{
                      marginTop: '8px',
                      maxHeight: '300px',
                      overflow: 'auto',
                      border: '1px solid #e1e3e5',
                      borderRadius: '4px'
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}
                    >
                      <thead style={{background: '#f6f6f7', position: 'sticky', top: 0}}>
                        <tr>
                          <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                            Order #
                          </th>
                          <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                            Tracking Number
                          </th>
                          <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                            Carrier
                          </th>
                          <th style={{padding: '8px', textAlign: 'center', borderBottom: '1px solid #e1e3e5', minWidth: '100px'}}>
                            Status
                          </th>
                          <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e1e3e5'}}>
                            Error Details
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedImport.trackingDetails.map((detail, idx) => (
                          <tr
                            key={idx}
                            style={{
                              background: idx % 2 === 0 ? '#fff' : '#fafbfb',
                              borderBottom: '1px solid #e1e3e5'
                            }}
                          >
                            <td style={{padding: '8px'}}>
                              <strong>{detail.orderNumber}</strong>
                            </td>
                            <td style={{padding: '8px', fontFamily: 'monospace'}}>
                              {detail.trackingNumber}
                            </td>
                            <td style={{padding: '8px'}}>{detail.carrier || '-'}</td>
                            <td style={{padding: '8px', textAlign: 'center'}}>
                              {detail.success ? (
                                <span style={{color: '#008060', fontWeight: 'bold'}}>Success</span>
                              ) : (
                                <span style={{color: '#d72c0d', fontWeight: 'bold'}}>Failed</span>
                              )}
                            </td>
                            <td style={{padding: '8px'}}>
                              {!detail.success && detail.error ? (
                                <Text variant="bodySm" as="p" tone="critical">
                                  {detail.error}
                                </Text>
                              ) : detail.success ? (
                                <Text variant="bodySm" as="p" tone="success">
                                  Tracking updated successfully
                                </Text>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedImport.invalidRecords && selectedImport.invalidRecords.length > 0 && (
                <div style={{marginBottom: '16px'}}>
                  <Text variant="bodyMd" as="p" fontWeight="semibold" tone="critical">
                    Invalid Records ({selectedImport.invalidRecords.length}):
                  </Text>
                  <div
                    style={{
                      marginTop: '8px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      background: '#f6f6f7',
                      padding: '8px',
                      borderRadius: '4px'
                    }}
                  >
                    {selectedImport.invalidRecords.map((invalid, idx) => (
                      <div key={idx} style={{marginBottom: '8px'}}>
                        <Text variant="bodySm" as="p">
                          <strong>Row {invalid.row}:</strong> {invalid.errors.join(', ')}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{marginBottom: '16px'}}>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  Created:
                </Text>
                <Text variant="bodyMd" as="p">
                  {new Date(selectedImport.createdAt).toLocaleString()}
                </Text>
              </div>

              {selectedImport.completedAt && (
                <div>
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    Completed:
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {new Date(selectedImport.completedAt).toLocaleString()}
                  </Text>
                </div>
              )}
            </div>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
