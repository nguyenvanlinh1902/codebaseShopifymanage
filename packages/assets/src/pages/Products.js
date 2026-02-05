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
  BlockStack,
  Tabs,
  ChoiceList
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Products Page - Upload, History, and Products List
 */
export default function Products() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStores, setSelectedStores] = useState([]); // For multi-store import
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [successfulImports, setSuccessfulImports] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  useEffect(() => {
    fetchStores();
    fetchImportHistory();
    fetchSuccessfulImports();
    fetchProducts();
    fetchQueueStats();
    // Poll queue stats every 30 seconds
    const interval = setInterval(fetchQueueStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTab === 2) {
      fetchProducts();
    }
  }, [selectedStore, selectedTab]);

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

  const fetchProducts = async () => {
    try {
      const url = selectedStore
        ? `/api/products/list?userId=${USER_ID}&storeId=${selectedStore}`
        : `/api/products/list?userId=${USER_ID}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await fetch('/api/products/queue-stats');
      const result = await response.json();
      if (result.success) {
        setQueueStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setProcessingQueue(true);
      setError(null);

      const response = await fetch('/api/products/process-queue', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
      });

      const result = await response.json();

      if (result.success) {
        // Update queue stats with the result
        setQueueStats(result.data);
        // Refresh other data
        await fetchImportHistory();
        await fetchProducts();
      } else {
        setError(result.error || 'Failed to process queue');
      }
    } catch (err) {
      console.error('Error processing queue:', err);
      setError('Failed to process queue');
    } finally {
      setProcessingQueue(false);
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
    if (selectedStores.length === 0) {
      setError('Please select at least one store');
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
            storeIds: selectedStores, // Send array of store IDs
            csvData,
            fileName: file.name
          })
        });

        const result = await response.json();

        if (result.success) {
          setFile(null);
          setSelectedStores([]); // Clear selection after upload
          await fetchImportHistory();
          await fetchSuccessfulImports();
          await fetchProducts();
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
    {label: 'All Stores', value: ''},
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

  const historyRows = importHistory.map(imp => [
    imp.fileName,
    stores.find(s => s.id === imp.storeId)?.name || imp.storeName,
    getStatusBadge(imp.status),
    `${imp.processedProducts || 0}/${imp.totalProducts}`,
    `${imp.successCount || 0} success, ${imp.failedCount || 0} failed`,
    new Date(imp.createdAt).toLocaleString(),
    <Button key={`btn-${imp.id}`} size="slim" onClick={() => viewImportDetails(imp.id)}>
      View Details
    </Button>
  ]);

  const productRows = products.map(product => [
    product.title,
    product.sku || '-',
    product.price ? `$${product.price}` : '-',
    product.vendor || '-',
    product.productType || '-',
    <Badge key={`badge-${product.id}`} tone={product.action === 'created' ? 'success' : 'info'}>
      {product.action || 'unknown'}
    </Badge>,
    stores.find(s => s.id === product.storeId)?.name || product.storeName || '-',
    new Date(product.createdAt).toLocaleString()
  ]);

  const tabs = [
    {
      id: 'upload',
      content: 'Upload CSV',
      panelID: 'upload-panel'
    },
    {
      id: 'history',
      content: 'Import History',
      panelID: 'history-panel'
    },
    {
      id: 'products',
      content: 'Products',
      panelID: 'products-panel'
    }
  ];

  return (
    <Page
      title="Product Management"
      subtitle="Import products from CSV and manage imported products"
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
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <div style={{padding: '16px'}}>
                {selectedTab === 0 && (
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Upload CSV File
                    </Text>

                    <ChoiceList
                      title="Select Stores (can select multiple)"
                      allowMultiple
                      choices={stores.map(store => ({
                        label: `${store.name} (${store.shopDomain})`,
                        value: store.id
                      }))}
                      selected={selectedStores}
                      onChange={setSelectedStores}
                      disabled={uploading}
                    />

                    {selectedStores.length > 0 && (
                      <Banner tone="info">
                        <Text as="p">
                          <strong>{selectedStores.length} store(s) selected:</strong> The CSV will be imported to all
                          selected stores.
                        </Text>
                      </Banner>
                    )}

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
                        disabled={selectedStores.length === 0 || !file}
                      >
                        Upload & Import to {selectedStores.length} Store{selectedStores.length !== 1 ? 's' : ''}
                      </Button>
                    </InlineStack>

                    <Banner tone="info">
                      <Text as="p">
                        <strong>CSV Format:</strong> Download the template to see the required columns. The CSV
                        must include: title, price, sku, and other product details.
                      </Text>
                    </Banner>

                    {queueStats && (
                      <Card>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="h3" variant="headingSm">
                              Queue Status
                            </Text>
                            <Button
                              onClick={handleProcessQueue}
                              loading={processingQueue}
                              disabled={queueStats.pending === 0}
                              variant="primary"
                            >
                              Process Now
                            </Button>
                          </InlineStack>
                          <InlineStack gap="400">
                            <BlockStack gap="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Pending
                              </Text>
                              <Text as="p" variant="headingLg">
                                {queueStats.pending}
                              </Text>
                            </BlockStack>
                            <BlockStack gap="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Processing
                              </Text>
                              <Text as="p" variant="headingLg">
                                {queueStats.processing}
                              </Text>
                            </BlockStack>
                            <BlockStack gap="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Completed
                              </Text>
                              <Text as="p" variant="headingLg">
                                {queueStats.completed}
                              </Text>
                            </BlockStack>
                            <BlockStack gap="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Failed
                              </Text>
                              <Text as="p" variant="headingLg">
                                {queueStats.failed}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          <Text as="p" variant="bodySm" tone="subdued">
                            CronJob runs automatically every minute to process up to 50 products per batch. You can
                            also process the queue immediately by clicking "Process Now". Stats update automatically
                            every 30 seconds.
                          </Text>
                        </BlockStack>
                      </Card>
                    )}

                    {successfulImports.length > 0 && (
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingSm">
                          Recent Successful Imports
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
                    )}
                  </BlockStack>
                )}

                {selectedTab === 1 && (
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
                )}

                {selectedTab === 2 && (
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Imported Products
                      </Text>
                      <div style={{minWidth: '200px'}}>
                        <Select
                          label="Filter by Store"
                          labelHidden
                          options={storeOptions}
                          value={selectedStore}
                          onChange={value => {
                            setSelectedStore(value);
                          }}
                        />
                      </div>
                    </InlineStack>

                    {products.length === 0 ? (
                      <EmptyState
                        heading="No products yet"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Import products from CSV to see them here.</p>
                      </EmptyState>
                    ) : (
                      <>
                        <DataTable
                          columnContentTypes={[
                            'text',
                            'text',
                            'numeric',
                            'text',
                            'text',
                            'text',
                            'text',
                            'text'
                          ]}
                          headings={[
                            'Title',
                            'SKU',
                            'Price',
                            'Vendor',
                            'Type',
                            'Action',
                            'Store',
                            'Imported At'
                          ]}
                          rows={productRows}
                        />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Showing {products.length} product{products.length !== 1 ? 's' : ''}
                        </Text>
                      </>
                    )}
                  </BlockStack>
                )}
              </div>
            </Tabs>
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
