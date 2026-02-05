import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  ProgressBar,
  DropZone,
  Modal
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Tracking Import Page - Upload Excel file to update order tracking numbers
 */
export default function Tracking() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchImportHistory();
    }
  }, [selectedStore]);

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
      const response = await fetch(`/api/stores?userId=${USER_ID}`);
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

  const fetchImportHistory = async () => {
    try {
      const url = selectedStore
        ? `/api/tracking/import-history?userId=${USER_ID}&storeId=${selectedStore}`
        : `/api/tracking/import-history?userId=${USER_ID}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setImportHistory(result.data);
      }
    } catch (err) {
      console.error('Error fetching import history:', err);
    }
  };

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

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async e => {
        const base64Data = e.target.result.split(',')[1];

        const response = await fetch('/api/tracking/upload-excel', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId: USER_ID,
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
      const response = await fetch('/api/tracking/template');
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

  const storeOptions = stores.map(store => ({
    label: store.name,
    value: store.id
  }));

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
          ✅ {imp.successCount || 0}
        </Text>
        {' / '}
        <Text variant="bodySm" as="span" tone="critical">
          ❌ {imp.failedCount || 0}
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

  const uploadFileMarkup = file ? (
    <div style={{padding: '16px', textAlign: 'center'}}>
      <Text variant="bodyMd" as="p">
        📄 {file.name}
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

  return (
    <Page title="Tracking Import" subtitle="Upload Excel file to update order tracking numbers">
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
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Upload Tracking File
            </Text>

            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : (
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
                    primary
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
            )}
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
                  No import history yet. Upload your first file to get started!
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                headings={[
                  'File',
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
                  File Name:
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
                          <th
                            style={{
                              padding: '8px',
                              textAlign: 'center',
                              borderBottom: '1px solid #e1e3e5',
                              minWidth: '100px'
                            }}
                          >
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
                                <span style={{color: '#008060', fontWeight: 'bold'}}>✅ Success</span>
                              ) : (
                                <span style={{color: '#d72c0d', fontWeight: 'bold'}}>❌ Failed</span>
                              )}
                            </td>
                            <td style={{padding: '8px'}}>
                              {!detail.success && detail.error ? (
                                <div>
                                  <Text variant="bodySm" as="p" tone="critical">
                                    {detail.error}
                                  </Text>
                                  {detail.errorType === 'ORDER_NOT_FOUND' && (
                                    <Text variant="bodySm" as="p" tone="subdued">
                                      💡 Order number "{detail.orderNumber}" không tồn tại trong store
                                    </Text>
                                  )}
                                  {detail.errorType === 'INVALID_ORDER_NUMBER' && (
                                    <Text variant="bodySm" as="p" tone="subdued">
                                      💡 Định dạng Order number không hợp lệ
                                    </Text>
                                  )}
                                  {detail.errorType === 'FULFILLMENT_FAILED' && (
                                    <Text variant="bodySm" as="p" tone="subdued">
                                      💡 Không thể tạo/cập nhật fulfillment cho order này
                                    </Text>
                                  )}
                                  {detail.errorType === 'SHOPIFY_API_ERROR' && (
                                    <Text variant="bodySm" as="p" tone="subdued">
                                      💡 Lỗi khi gọi Shopify API
                                    </Text>
                                  )}
                                </div>
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
