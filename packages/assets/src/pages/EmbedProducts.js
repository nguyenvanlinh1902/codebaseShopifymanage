import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Card,
  Button,
  DataTable,
  Banner,
  Text,
  DropZone,
  InlineStack,
  SkeletonBodyText,
  EmptyState,
  BlockStack,
  Box,
  Icon,
  TextField,
  Select,
  InlineGrid,
  Badge,
  Divider,
  Modal
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  SearchIcon,
  ImportIcon,
  DeleteIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

export default function EmbedProducts() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
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
    fetchProducts();
  }, [currentPage, itemsPerPage, debouncedSearch]);

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
  }, []);

  const handleFileRemove = useCallback(index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const readFileAsText = file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

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
        setUploadModalOpen(false);
        await fetchProducts();
        await fetchQueueStats();
        if (totalFailed > 0) {
          setError(
            `Import completed: ${totalSuccess} created, ${totalFailed} failed (queued for retry)`
          );
        } else {
          setSuccessMessage(`Successfully imported ${totalSuccess} products!`);
        }
      } else {
        let errorMsg = result.error || 'Import failed';
        if (result.fileErrors) {
          errorMsg +=
            '\n' + result.fileErrors.map(fe => `${fe.fileName}: ${fe.error}`).join('\n');
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

  const handleCloseModal = () => {
    if (!uploading) {
      setUploadModalOpen(false);
      setFiles([]);
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

  return (
    <Page
      title="Products"
      subtitle="Import and manage products from CSV"
      primaryAction={{
        content: 'Import CSV',
        icon: ImportIcon,
        onAction: () => setUploadModalOpen(true)
      }}
      secondaryActions={[{content: 'Download Template', onAction: handleDownloadTemplate}]}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        {successMessage && (
          <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Banner>
        )}

        {/* Queue Status */}
        {queueStats &&
          (queueStats.pending > 0 || queueStats.completed > 0 || queueStats.failed > 0) && (
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  Import Queue
                </Text>
                <Button
                  onClick={handleProcessQueue}
                  loading={processingQueue}
                  disabled={queueStats.pending === 0}
                  size="slim"
                >
                  Process Now
                </Button>
              </InlineStack>

              <InlineGrid columns={3} gap="400">
                <Card>
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                      <Icon source={ClockIcon} tone="base" />
                    </Box>
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p" fontWeight="bold">
                        {queueStats.pending}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Pending
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
                <Card>
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                      <Icon source={CheckCircleIcon} tone="success" />
                    </Box>
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p" fontWeight="bold">
                        {queueStats.completed}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Completed
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
                <Card>
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-fill-critical-secondary" borderRadius="300" padding="200">
                      <Icon source={AlertCircleIcon} tone="critical" />
                    </Box>
                    <BlockStack gap="050">
                      <Text variant="headingLg" as="p" fontWeight="bold">
                        {queueStats.failed}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Failed
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              </InlineGrid>
            </BlockStack>
          )}

        {/* Products List */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">
                Imported Products
              </Text>
              {totalProducts > 0 && <Badge>{totalProducts} total</Badge>}
            </InlineStack>

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
                action={{
                  content: 'Import CSV',
                  onAction: () => setUploadModalOpen(true)
                }}
              >
                <Text>
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Import products from CSV to see them here.'}
                </Text>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <DataTable
                  columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
                  headings={['Title', 'SKU', 'Price', 'Vendor', 'Type', 'Imported At']}
                  rows={productRows}
                />
                {totalProducts > 0 && (
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <Text variant="bodySm" tone="subdued">
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
                      <Text variant="bodySm">
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
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Upload Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={handleCloseModal}
        title="Import Products from CSV"
        primaryAction={{
          content: files.length > 0
            ? `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`
            : 'Upload',
          onAction: handleUpload,
          loading: uploading,
          disabled: files.length === 0
        }}
        secondaryActions={[{content: 'Cancel', onAction: handleCloseModal, disabled: uploading}]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <DropZone
              onDrop={handleDropZoneDrop}
              accept=".csv,text/csv"
              type="file"
              allowMultiple
              disabled={uploading}
            >
              <DropZone.FileUpload actionHint="Accepts .csv files" />
            </DropZone>

            {files.length > 0 && (
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </Text>
                <Divider />
                {files.map((f, index) => (
                  <InlineStack
                    key={`${f.name}-${index}`}
                    align="space-between"
                    blockAlign="center"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      <Badge size="small">{(f.size / 1024).toFixed(1)} KB</Badge>
                      <Text variant="bodyMd">{f.name}</Text>
                    </InlineStack>
                    <Button
                      onClick={() => handleFileRemove(index)}
                      icon={DeleteIcon}
                      size="slim"
                      tone="critical"
                      variant="plain"
                      disabled={uploading}
                    />
                  </InlineStack>
                ))}
              </BlockStack>
            )}

            <Button onClick={handleDownloadTemplate} variant="plain" size="slim">
              Download CSV template
            </Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
