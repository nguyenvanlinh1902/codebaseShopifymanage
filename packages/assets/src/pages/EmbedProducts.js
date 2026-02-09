import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Banner,
  Text,
  DropZone,
  InlineStack,
  Badge,
  SkeletonBodyText,
  EmptyState,
  BlockStack,
  Tabs,
  Box,
  Divider,
  Icon,
  ProgressBar,
  TextField,
  Checkbox,
  Select
} from '@shopify/polaris';
import {CheckCircleIcon, ClockIcon, AlertCircleIcon, SearchIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

/**
 * Embedded Products Page - Single store (from session token)
 * Features: CSV import, product list with search, queue status
 */
export default function EmbedProducts() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchProducts();
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedTab === 1) fetchProducts();
  }, [selectedTab, currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({page: currentPage, limit: itemsPerPage});
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await api(`/api/embed/products/list?${params}`);
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
      const response = await api('/api/embed/products/queue-stats');
      const result = await response.json();
      if (result.success) setQueueStats(result.data);
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setProcessingQueue(true);
      setError(null);
      const response = await api('/api/embed/products/process-queue', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
      });
      const result = await response.json();
      if (result.success) {
        setQueueStats(result.data);
        await fetchProducts();
      } else {
        setError(result.error || 'Failed to process queue');
      }
    } catch (err) {
      setError('Failed to process queue');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const handleFileRemove = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const csvFiles = [];
      for (const f of files) {
        const csvData = await readFileAsText(f);
        csvFiles.push({csvData, fileName: f.name});
      }

      const response = await api('/api/embed/products/upload-csv', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({csvFiles})
      });

      const result = await response.json();
      if (result.success) {
        const {totalSuccess, totalFailed} = result.data;
        setFiles([]);
        await fetchProducts();
        await fetchQueueStats();
        if (totalFailed > 0) {
          setError(`Import completed: ${totalSuccess} created, ${totalFailed} failed (queued for retry)`);
        }
      } else {
        let errorMsg = result.error || 'Import failed';
        if (result.fileErrors) {
          errorMsg += '\n' + result.fileErrors.map(fe => `${fe.fileName}: ${fe.error}`).join('\n');
        }
        setError(errorMsg);
      }
    } catch (err) {
      setError('Failed to upload CSV files');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api('/api/embed/products/template');
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
      setError('Failed to download template');
    }
  };

  const productRows = products.map(product => [
    product.title,
    product.sku || '-',
    product.price ? `$${product.price}` : '-',
    product.vendor || '-',
    product.productType || '-',
    new Date(product.createdAt).toLocaleString()
  ]);

  const tabs = [
    {id: 'upload', content: 'Upload & Import', panelID: 'upload-panel'},
    {id: 'products', content: 'Products List', panelID: 'products-panel'}
  ];

  return (
    <Page
      title="Product Import"
      subtitle="Import products from CSV to your Shopify store"
      secondaryActions={[{content: 'Download CSV Template', onAction: handleDownloadTemplate}]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <div style={{padding: '16px'}}>
                {selectedTab === 0 && (
                  <BlockStack gap="400">
                    <Card>
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">Upload CSV Files</Text>
                        <DropZone
                          onDrop={handleDropZoneDrop}
                          accept=".csv,text/csv"
                          type="file"
                          allowMultiple
                          disabled={uploading}
                        >
                          <DropZone.FileUpload />
                        </DropZone>
                        {files.length > 0 && (
                          <BlockStack gap="200">
                            {files.map((f, index) => (
                              <InlineStack key={`${f.name}-${index}`} align="space-between" blockAlign="center">
                                <InlineStack gap="200">
                                  <Text as="p" variant="bodyMd">{f.name}</Text>
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    {(f.size / 1024).toFixed(2)} KB
                                  </Text>
                                </InlineStack>
                                <Button onClick={() => handleFileRemove(index)} size="slim">Remove</Button>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Card>

                    <InlineStack align="end">
                      <Button
                        variant="primary"
                        onClick={handleUpload}
                        loading={uploading}
                        disabled={files.length === 0}
                      >
                        Upload & Import {files.length} File{files.length !== 1 ? 's' : ''}
                      </Button>
                    </InlineStack>

                    {queueStats && (
                      <Card>
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="h2" variant="headingMd">Import Queue Status</Text>
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
                            <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={ClockIcon} tone="base" />
                                  <Text as="p" variant="bodySm" tone="subdued">Pending</Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">{queueStats.pending}</Text>
                              </BlockStack>
                            </Box>
                            <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={CheckCircleIcon} tone="success" />
                                  <Text as="p" variant="bodySm" tone="subdued">Completed</Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">{queueStats.completed}</Text>
                              </BlockStack>
                            </Box>
                            <Box padding="400" background="bg-surface-secondary" borderRadius="200" minWidth="120px">
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center">
                                  <Icon source={AlertCircleIcon} tone="critical" />
                                  <Text as="p" variant="bodySm" tone="subdued">Failed</Text>
                                </InlineStack>
                                <Text as="p" variant="heading2xl">{queueStats.failed}</Text>
                              </BlockStack>
                            </Box>
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    )}
                  </BlockStack>
                )}

                {selectedTab === 1 && (
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Imported Products</Text>

                    <TextField
                      label="Search"
                      labelHidden
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search by title, SKU, or vendor..."
                      prefix={<Icon source={SearchIcon} />}
                      clearButton
                      onClearButtonClick={() => setSearchQuery('')}
                    />

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
                          columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
                          headings={['Title', 'SKU', 'Price', 'Vendor', 'Type', 'Imported At']}
                          rows={productRows}
                        />
                        {totalProducts > 0 && (
                          <Box padding="400">
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <Text as="p" variant="bodySm" tone="subdued">
                                Showing {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                                {searchQuery && ' (filtered)'}
                              </Text>
                              <InlineStack gap="300" blockAlign="center">
                                <Select
                                  label="Per page"
                                  labelInline
                                  options={[
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
                                  &larr;
                                </Button>
                                <Text as="span" variant="bodySm">
                                  {currentPage} / {totalPages}
                                </Text>
                                <Button
                                  size="slim"
                                  onClick={() => setCurrentPage(currentPage + 1)}
                                  disabled={currentPage === totalPages || loading}
                                >
                                  &rarr;
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
    </Page>
  );
}
