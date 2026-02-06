import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Select,
  Banner,
  Text,
  DropZone,
  InlineStack,
  Badge,
  SkeletonBodyText,
  EmptyState,
  Modal,
  BlockStack
} from '@shopify/polaris';
import {USER_ID} from '../config/user';

/**
 * Products Import Page - CSV Upload
 */
export default function Products() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [successfulImports, setSuccessfulImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);

  useEffect(() => {
    fetchStores();
    fetchImportHistory();
    fetchSuccessfulImports();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch(`/api/stores?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchImportHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/import-history?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setImportHistory(result.data);
      }
    } catch (err) {
      console.error('Error fetching import history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuccessfulImports = async () => {
    try {
      const response = await fetch(`/api/products/successful-imports?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setSuccessfulImports(result.data);
      }
    } catch (err) {
      console.error('Error fetching successful imports:', err);
    }
  };

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleFileRemove = useCallback(() => {
    setFile(null);
  }, []);

  const handleUpload = async () => {
    if (!selectedStore) {
      setError('Please select a store');
      return;
    }

    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Read file content
      const reader = new FileReader();
      reader.onload = async e => {
        const csvData = e.target.result;

        const response = await fetch('/api/products/upload-csv', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId: USER_ID,
            storeId: selectedStore,
            csvData,
            fileName: file.name
          })
        });

        const result = await response.json();

        if (result.success) {
          setFile(null);
          await fetchImportHistory();
          await fetchSuccessfulImports();
        } else {
          setError(result.error || 'Failed to upload CSV');
        }

        setUploading(false);
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };

      reader.readAsText(file);
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError('Failed to upload CSV');
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/products/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-import-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading template:', err);
      setError('Failed to download template');
    }
  };

  const viewImportDetails = async importId => {
    try {
      const response = await fetch(`/api/products/imports/${importId}`);
      const result = await response.json();
      if (result.success) {
        setDetailsModal(result.data);
      }
    } catch (err) {
      console.error('Error fetching import details:', err);
    }
  };

  const storeOptions = [
    {label: 'Select a store', value: ''},
    ...stores.map(store => ({
      label: `${store.name} (${store.shopDomain})`,
      value: store.id
    }))
  ];

  const fileUpload = !file && <DropZone.FileUpload />;

  const uploadedFiles = file && (
    <InlineStack align="space-between" blockAlign="center">
      <InlineStack gap="200">
        <Text as="p" variant="bodyMd">
          {file.name}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {(file.size / 1024).toFixed(2)} KB
        </Text>
      </InlineStack>
      <Button onClick={handleFileRemove}>Remove</Button>
    </InlineStack>
  );

  const getStatusBadge = status => {
    const toneMap = {
      pending: 'info',
      processing: 'attention',
      completed: 'success',
      failed: 'critical'
    };
    return <Badge tone={toneMap[status] || 'info'}>{status}</Badge>;
  };

  const historyRows = importHistory.map((imp, index) => [
    imp.fileName,
    stores.find(s => s.id === imp.storeId)?.name || imp.storeName,
    getStatusBadge(imp.status),
    `${imp.processedProducts || 0}/${imp.totalProducts}`,
    `${imp.successCount || 0} success, ${imp.failedCount || 0} failed`,
    new Date(imp.createdAt).toLocaleString(),
    <Button key={index} size="slim" onClick={() => viewImportDetails(imp.id)}>
      View Details
    </Button>
  ]);

  return (
    <Page
      title="Product Import"
      subtitle="Import products from CSV file"
      secondaryActions={[{content: 'Download CSV Template', onAction: handleDownloadTemplate}]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Upload CSV File
              </Text>

              <Select
                label="Select Store"
                options={storeOptions}
                value={selectedStore}
                onChange={setSelectedStore}
                disabled={uploading}
              />

              <DropZone
                onDrop={handleDropZoneDrop}
                accept=".csv,text/csv"
                type="file"
                disabled={uploading}
              >
                {uploadedFiles}
                {fileUpload}
              </DropZone>

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={!selectedStore || !file}
                >
                  Upload & Import
                </Button>
              </InlineStack>

              <Banner tone="info">
                <Text as="p">
                  <strong>CSV Format:</strong> Download the template to see the required columns.
                  The CSV must include: title, price, sku, and other product details.
                </Text>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>

        {successfulImports.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Successful Imports by Store
                </Text>
                {successfulImports.map(storeImport => (
                  <BlockStack key={storeImport.storeId} gap="200">
                    <Text as="p" variant="headingSm">
                      {storeImport.storeName} ({storeImport.shopDomain})
                    </Text>
                    {storeImport.imports.map(imp => (
                      <InlineStack key={imp.importId} gap="200">
                        <Text as="p">
                          {imp.fileName} - {imp.successCount} products -{' '}
                          {new Date(imp.completedAt).toLocaleDateString()}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Import History
              </Text>

              {loading ? (
                <SkeletonBodyText lines={5} />
              ) : importHistory.length === 0 ? (
                <EmptyState
                  heading="No imports yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Upload a CSV file to start importing products.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['File', 'Store', 'Status', 'Progress', 'Results', 'Date', 'Actions']}
                  rows={historyRows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {detailsModal && (
        <Modal
          open={!!detailsModal}
          onClose={() => setDetailsModal(null)}
          title="Import Details"
          primaryAction={{content: 'Close', onAction: () => setDetailsModal(null)}}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text as="p">
                <strong>File:</strong> {detailsModal.fileName}
              </Text>
              <Text as="p">
                <strong>Store:</strong> {detailsModal.storeName}
              </Text>
              <Text as="p">
                <strong>Status:</strong> {getStatusBadge(detailsModal.status)}
              </Text>
              <Text as="p">
                <strong>Total Products:</strong> {detailsModal.totalProducts}
              </Text>
              <Text as="p">
                <strong>Processed:</strong> {detailsModal.processedProducts || 0}
              </Text>
              <Text as="p">
                <strong>Success:</strong> {detailsModal.successCount || 0}
              </Text>
              <Text as="p">
                <strong>Failed:</strong> {detailsModal.failedCount || 0}
              </Text>
              {detailsModal.error && (
                <Banner tone="critical">
                  <Text as="p">{detailsModal.error}</Text>
                </Banner>
              )}
              {detailsModal.invalidProducts && detailsModal.invalidProducts.length > 0 && (
                <BlockStack gap="200">
                  <Text as="p" variant="headingSm">
                    Invalid Products:
                  </Text>
                  {detailsModal.invalidProducts.map((inv, idx) => (
                    <Text key={idx} as="p" tone="critical">
                      Row {inv.row}: {inv.errors.join(', ')}
                    </Text>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
