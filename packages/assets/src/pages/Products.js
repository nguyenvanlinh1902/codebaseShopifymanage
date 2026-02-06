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
  BlockStack,
  Tabs,
  ChoiceList,
  Box,
  Divider,
  Icon,
  ProgressBar,
  TextField,
  Checkbox,
  Modal
} from '@shopify/polaris';
import {CheckCircleIcon, ClockIcon, AlertCircleIcon, SearchIcon} from '@shopify/polaris-icons';
import {USER_ID} from '../config/user';

/**
 * Products Page - Enhanced version
 * Features:
 * - Multi-store CSV import
 * - Multi-select products with checkboxes
 * - Search functionality (title, SKU, vendor, type)
 * - Re-import selected products to other stores
 * - Real-time import status per store
 * - Auto CronJob + Manual processing
 * - Full product field support (48 columns)
 */
export default function Products() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [storeImportStatus, setStoreImportStatus] = useState([]);

  // New states for search and selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showReimportModal, setShowReimportModal] = useState(false);
  const [reimportStores, setReimportStores] = useState([]);
  const [reimporting, setReimporting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchStores();
    fetchProducts();
    fetchQueueStats();
    fetchStoreImportStatus();

    // Poll queue stats and store status every 10 seconds
    const interval = setInterval(() => {
      fetchQueueStats();
      fetchStoreImportStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTab === 1) {
      fetchProducts();
    }
  }, [selectedStore, selectedTab, currentPage, itemsPerPage, searchQuery]);

  const fetchStores = async () => {
    try {
      const response = await fetch(`/api/stores?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId: USER_ID,
        page: currentPage,
        limit: itemsPerPage
      });

      if (selectedStore) {
        params.append('storeId', selectedStore);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/products/list?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data || []);
        if (result.pagination) {
          setTotalProducts(result.pagination.total);
          setTotalPages(result.pagination.totalPages);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
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

  const fetchStoreImportStatus = async () => {
    try {
      const response = await fetch(`/api/products/successful-imports?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setStoreImportStatus(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching store import status:', err);
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
        setQueueStats(result.data);
        await fetchProducts();
        await fetchStoreImportStatus();
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

      const reader = new FileReader();
      reader.onload = async e => {
        const csvData = e.target.result;

        const response = await fetch('/api/products/upload-csv', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId: USER_ID,
            storeIds: selectedStores,
            csvData,
            fileName: file.name
          })
        });

        const result = await response.json();

        if (result.success) {
          setFile(null);
          setSelectedStores([]);
          await fetchProducts();
          await fetchStoreImportStatus();
          await fetchQueueStats();
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

  // Reset to first page when search query or store changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStore]);

  // Handle product selection
  const handleProductSelect = (productId, checked) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId]);
    } else {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    }
  };

  const handleSelectAll = checked => {
    if (checked) {
      setSelectedProducts(products.map(p => p.id));
    } else {
      setSelectedProducts([]);
    }
  };

  // Handle re-import to other stores
  const handleReimport = async () => {
    if (reimportStores.length === 0) {
      setError('Please select at least one store to import to');
      return;
    }

    try {
      setReimporting(true);
      setError(null);

      // Get selected product details
      const selectedProductDetails = products.filter(p => selectedProducts.includes(p.id));

      // Convert products to CSV format
      const csvHeaders = [
        'Title',
        'Body (HTML)',
        'Vendor',
        'Type',
        'Tags',
        'Published',
        'Variant SKU',
        'Variant Price',
        'Variant Compare At Price',
        'Variant Inventory Qty'
      ];

      const csvRows = selectedProductDetails.map(p => [
        p.title || '',
        p.description || '',
        p.vendor || '',
        p.productType || '',
        p.tags || '',
        p.status === 'active' ? 'TRUE' : 'FALSE',
        p.sku || '',
        p.price || '',
        p.compareAtPrice || '',
        p.inventoryQuantity || 0
      ]);

      const csvData = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');

      const response = await fetch('/api/products/upload-csv', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          storeIds: reimportStores,
          csvData,
          fileName: `reimport-${Date.now()}.csv`
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowReimportModal(false);
        setReimportStores([]);
        setSelectedProducts([]);
        await fetchProducts();
        await fetchStoreImportStatus();
        await fetchQueueStats();
      } else {
        setError(result.error || 'Failed to reimport products');
      }
    } catch (err) {
      console.error('Error reimporting products:', err);
      setError('Failed to reimport products');
    } finally {
      setReimporting(false);
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

  const productRows = products.map(product => [
    <Checkbox
      key={`checkbox-${product.id}`}
      checked={selectedProducts.includes(product.id)}
      onChange={checked => handleProductSelect(product.id, checked)}
    />,
    product.title,
    product.sku || '-',
    product.price ? `$${product.price}` : '-',
    product.vendor || '-',
    product.productType || '-',
    stores.find(s => s.id === product.storeId)?.name || product.storeName || '-',
    new Date(product.createdAt).toLocaleString()
  ]);

  const tabs = [
    {
      id: 'upload',
      content: 'Upload & Import',
      panelID: 'upload-panel'
    },
    {
      id: 'products',
      content: 'Products List',
      panelID: 'products-panel'
    }
  ];

  return (
    <Page
      title="Product Management"
      subtitle="Import products from CSV to multiple Shopify stores"
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
                    {/* File Upload - Step 1 */}
                    <Card>
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">
                          Step 1: Upload CSV File
                        </Text>
                        <DropZone
                          onDrop={handleDropZoneDrop}
                          accept=".csv,text/csv"
                          type="file"
                          disabled={uploading}
                        >
                          {uploadedFiles}
                          {fileUpload}
                        </DropZone>
                      </BlockStack>
                    </Card>

                    {/* Store Selection - Step 2 */}
                    <Card>
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">
                          Step 2: Select Target Stores
                        </Text>

                        {!file && (
                          <Banner tone="warning">
                            <Text as="p">
                              Please upload a CSV file first before selecting stores.
                            </Text>
                          </Banner>
                        )}

                        {file && (
                          <Banner tone="info">
                            <Text as="p">
                              <strong>File ready:</strong> {file.name} (
                              {(file.size / 1024).toFixed(2)} KB)
                            </Text>
                          </Banner>
                        )}

                        <ChoiceList
                          title="Import products to these stores (multiple selection allowed)"
                          allowMultiple
                          choices={stores.map(store => ({
                            label: `${store.name} (${store.shopDomain})`,
                            value: store.id
                          }))}
                          selected={selectedStores}
                          onChange={setSelectedStores}
                          disabled={uploading || !file}
                        />

                        {selectedStores.length > 0 && file && (
                          <Banner tone="success">
                            <Text as="p">
                              <strong>{selectedStores.length} store(s) selected:</strong> Products
                              from <strong>{file.name}</strong> will be imported to all selected
                              stores simultaneously.
                            </Text>
                          </Banner>
                        )}

                        <InlineStack align="end">
                          <Button
                            variant="primary"
                            onClick={handleUpload}
                            loading={uploading}
                            disabled={selectedStores.length === 0 || !file}
                          >
                            Upload & Import to {selectedStores.length} Store
                            {selectedStores.length !== 1 ? 's' : ''}
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>

                    {/* Queue Status & Processing */}
                    {queueStats && (
                      <Card>
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="h2" variant="headingMd">
                              Import Queue Status
                            </Text>
                            <Button
                              onClick={handleProcessQueue}
                              loading={processingQueue}
                              disabled={queueStats.pending === 0}
                              variant="primary"
                            >
                              Manual Process Now
                            </Button>
                          </InlineStack>

                          <InlineStack gap="400" wrap>
                            <Box
                              padding="400"
                              background="bg-surface-secondary"
                              borderRadius="200"
                              minWidth="150px"
                            >
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={ClockIcon} tone="base" />
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Pending
                                  </Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">
                                  {queueStats.pending}
                                </Text>
                              </BlockStack>
                            </Box>

                            <Box
                              padding="400"
                              background="bg-surface-secondary"
                              borderRadius="200"
                              minWidth="150px"
                            >
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={ClockIcon} tone="caution" />
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Processing
                                  </Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">
                                  {queueStats.processing}
                                </Text>
                              </BlockStack>
                            </Box>

                            <Box
                              padding="400"
                              background="bg-surface-secondary"
                              borderRadius="200"
                              minWidth="150px"
                            >
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={CheckCircleIcon} tone="success" />
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Completed
                                  </Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">
                                  {queueStats.completed}
                                </Text>
                              </BlockStack>
                            </Box>

                            <Box
                              padding="400"
                              background="bg-surface-secondary"
                              borderRadius="200"
                              minWidth="150px"
                            >
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={AlertCircleIcon} tone="critical" />
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    Failed
                                  </Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">
                                  {queueStats.failed}
                                </Text>
                              </BlockStack>
                            </Box>
                          </InlineStack>

                          <Divider />

                          <Banner tone="info">
                            <BlockStack gap="200">
                              <Text as="p">
                                <strong>Automatic Processing (CronJob):</strong>
                              </Text>
                              <Text as="p" tone="subdued">
                                • Runs automatically every minute
                              </Text>
                              <Text as="p" tone="subdued">
                                • Processes up to 100 products per batch
                              </Text>
                              <Text as="p" tone="subdued">
                                • Retries failed products up to 3 times
                              </Text>
                              <Text as="p" tone="subdued">
                                • Queue stats update every 10 seconds
                              </Text>
                            </BlockStack>
                          </Banner>

                          <Banner tone="success">
                            <Text as="p">
                              <strong>Manual Processing:</strong> Click "Manual Process Now" to
                              immediately process pending products without waiting for the CronJob.
                            </Text>
                          </Banner>
                        </BlockStack>
                      </Card>
                    )}

                    {/* Store Import Status */}
                    {storeImportStatus.length > 0 && (
                      <Card>
                        <BlockStack gap="400">
                          <Text as="h2" variant="headingMd">
                            Import Status by Store
                          </Text>

                          {storeImportStatus.map(storeImport => {
                            const totalSuccess = storeImport.imports.reduce(
                              (sum, imp) => sum + (imp.successCount || 0),
                              0
                            );
                            const latestImport = storeImport.imports[0];

                            return (
                              <Box
                                key={storeImport.storeId}
                                padding="400"
                                background="bg-surface-secondary"
                                borderRadius="200"
                              >
                                <BlockStack gap="300">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <BlockStack gap="100">
                                      <Text as="p" variant="headingSm" fontWeight="semibold">
                                        {storeImport.storeName}
                                      </Text>
                                      <Text as="p" variant="bodySm" tone="subdued">
                                        {storeImport.shopDomain}
                                      </Text>
                                    </BlockStack>
                                    <Badge tone="success">{totalSuccess} products imported</Badge>
                                  </InlineStack>

                                  <Divider />

                                  <Text as="p" variant="bodySm" fontWeight="semibold">
                                    Recent Imports:
                                  </Text>

                                  {storeImport.imports.slice(0, 3).map(imp => (
                                    <Box
                                      key={imp.importId}
                                      padding="200"
                                      background="bg-surface"
                                      borderRadius="100"
                                    >
                                      <InlineStack align="space-between" blockAlign="center">
                                        <BlockStack gap="050">
                                          <Text as="p" variant="bodySm">
                                            {imp.fileName}
                                          </Text>
                                          <Text as="p" variant="bodySm" tone="subdued">
                                            {new Date(imp.completedAt).toLocaleString()}
                                          </Text>
                                        </BlockStack>
                                        <Badge tone="success">{imp.successCount} products</Badge>
                                      </InlineStack>
                                    </Box>
                                  ))}
                                </BlockStack>
                              </Box>
                            );
                          })}
                        </BlockStack>
                      </Card>
                    )}
                  </BlockStack>
                )}

                {selectedTab === 1 && (
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                      <Text as="h2" variant="headingMd">
                        Imported Products
                      </Text>
                      <InlineStack gap="200">
                        {selectedProducts.length > 0 && (
                          <Button onClick={() => setShowReimportModal(true)} variant="primary">
                            Import {selectedProducts.length} Selected
                          </Button>
                        )}
                        <div style={{minWidth: '250px'}}>
                          <Select
                            label="Filter by Store"
                            labelHidden
                            options={storeOptions}
                            value={selectedStore}
                            onChange={value => {
                              setSelectedStore(value);
                              setSelectedProducts([]);
                            }}
                          />
                        </div>
                      </InlineStack>
                    </InlineStack>

                    <TextField
                      label="Search"
                      labelHidden
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search by title, SKU, vendor, type..."
                      prefix={<Icon source={SearchIcon} />}
                      clearButton
                      onClearButtonClick={() => setSearchQuery('')}
                    />

                    {selectedProducts.length > 0 && (
                      <Banner tone="info">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="p">
                            <strong>{selectedProducts.length}</strong> product
                            {selectedProducts.length !== 1 ? 's' : ''} selected
                          </Text>
                          <Button onClick={() => setSelectedProducts([])} size="slim">
                            Clear Selection
                          </Button>
                        </InlineStack>
                      </Banner>
                    )}

                    {loading ? (
                      <SkeletonBodyText lines={8} />
                    ) : products.length === 0 ? (
                      <EmptyState
                        heading={searchQuery ? 'No products found' : 'No products yet'}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        {searchQuery ? (
                          <p>Try adjusting your search query</p>
                        ) : (
                          <p>Import products from CSV to see them here.</p>
                        )}
                      </EmptyState>
                    ) : (
                      <>
                        <DataTable
                          columnContentTypes={[
                            'text',
                            'text',
                            'text',
                            'numeric',
                            'text',
                            'text',
                            'text',
                            'text'
                          ]}
                          headings={[
                            <Checkbox
                              key="select-all"
                              checked={
                                selectedProducts.length === products.length && products.length > 0
                              }
                              onChange={handleSelectAll}
                            />,
                            'Title',
                            'SKU',
                            'Price',
                            'Vendor',
                            'Type',
                            'Store',
                            'Imported At'
                          ]}
                          rows={productRows}
                        />

                        {/* Backend Pagination */}
                        {totalProducts > 0 && (
                          <Box padding="400">
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <Text as="p" variant="bodySm" tone="subdued">
                                Showing {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(currentPage * itemsPerPage, totalProducts)} of{' '}
                                {totalProducts}
                                {searchQuery && ` (filtered)`}
                              </Text>

                              <InlineStack gap="300" blockAlign="center">
                                <Select
                                  label="Per page"
                                  labelInline
                                  options={[
                                    {label: '25', value: '25'},
                                    {label: '50', value: '50'},
                                    {label: '100', value: '100'},
                                    {label: '200', value: '200'}
                                  ]}
                                  value={String(itemsPerPage)}
                                  onChange={value => {
                                    setItemsPerPage(Number(value));
                                    setCurrentPage(1);
                                  }}
                                />

                                <Button
                                  size="slim"
                                  onClick={() => setCurrentPage(currentPage - 1)}
                                  disabled={currentPage === 1 || loading}
                                >
                                  ←
                                </Button>

                                <Text as="span" variant="bodySm">
                                  {currentPage} / {totalPages}
                                </Text>

                                <Button
                                  size="slim"
                                  onClick={() => setCurrentPage(currentPage + 1)}
                                  disabled={currentPage === totalPages || loading}
                                >
                                  →
                                </Button>
                              </InlineStack>
                            </InlineStack>
                          </Box>
                        )}
                      </>
                    )}
                  </BlockStack>
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Re-import Modal */}
      {showReimportModal && (
        <Modal
          open={showReimportModal}
          onClose={() => {
            setShowReimportModal(false);
            setReimportStores([]);
          }}
          title="Import Selected Products to Other Stores"
          primaryAction={{
            content: `Import to ${reimportStores.length} Store${
              reimportStores.length !== 1 ? 's' : ''
            }`,
            onAction: handleReimport,
            loading: reimporting,
            disabled: reimportStores.length === 0
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => {
                setShowReimportModal(false);
                setReimportStores([]);
              }
            }
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text as="p">
                You have selected <strong>{selectedProducts.length}</strong> product
                {selectedProducts.length !== 1 ? 's' : ''}. Choose which stores to import them to:
              </Text>

              <ChoiceList
                title="Select target stores"
                allowMultiple
                choices={stores.map(store => ({
                  label: `${store.name} (${store.shopDomain})`,
                  value: store.id
                }))}
                selected={reimportStores}
                onChange={setReimportStores}
              />

              <Banner tone="warning">
                <Text as="p">
                  <strong>Note:</strong> If products with the same SKU already exist in the target
                  stores, they will be updated. Otherwise, new products will be created.
                </Text>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
