import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Card, Banner, Tabs} from '@shopify/polaris';
import {api} from '../helpers/api';
import FileUploadSection from './products/FileUploadSection';
import StoreSelectionSection from './products/StoreSelectionSection';
import QueueStatusSection from './products/QueueStatusSection';
import StoreImportStatusSection from './products/StoreImportStatusSection';
import ProductsTableSection from './products/ProductsTableSection';
import ReimportModal from './products/ReimportModal';

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
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [storeImportStatus, setStoreImportStatus] = useState([]);

  // Search and selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

    const interval = setInterval(() => {
      fetchQueueStats();
      fetchStoreImportStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedTab === 1) {
      fetchProducts();
    }
  }, [selectedStore, selectedTab, currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStore]);

  const fetchStores = async () => {
    try {
      const response = await api('/api/stores');
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
        page: currentPage,
        limit: itemsPerPage
      });

      if (selectedStore) {
        params.append('storeId', selectedStore);
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await api(`/api/products/list?${params.toString()}`);
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
      const response = await api('/api/products/queue-stats');
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
      const response = await api('/api/products/successful-imports');
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

      const response = await api('/api/products/process-queue', {
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
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
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
    if (selectedStores.length === 0) {
      setError('Please select at least one store');
      return;
    }

    if (files.length === 0) {
      setError('Please select at least one CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const csvFiles = [];
      for (const f of files) {
        try {
          const csvData = await readFileAsText(f);
          csvFiles.push({csvData, fileName: f.name});
        } catch (err) {
          setError(`Failed to read file: ${f.name}`);
          setUploading(false);
          return;
        }
      }

      const response = await api('/api/products/upload-csv', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storeIds: selectedStores,
          csvFiles
        })
      });

      const result = await response.json();

      if (result.success) {
        const {totalSuccess, totalFailed} = result.data;
        setFiles([]);
        setSelectedStores([]);
        await fetchProducts();
        await fetchStoreImportStatus();
        await fetchQueueStats();

        if (totalFailed > 0) {
          setError(
            `Import completed with errors: ${totalSuccess} created, ${totalFailed} failed (queued for retry)`
          );
        }
      } else {
        let errorMsg = result.error || 'Import failed';
        if (result.fileErrors) {
          errorMsg += '\n' + result.fileErrors.map(fe => `${fe.fileName}: ${fe.error}`).join('\n');
        }
        setError(errorMsg);
      }

      setUploading(false);
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError('Failed to upload CSV files');
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api('/api/products/template');
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

  const handleReimport = async () => {
    if (reimportStores.length === 0) {
      setError('Please select at least one store to import to');
      return;
    }

    try {
      setReimporting(true);
      setError(null);

      const selectedProductDetails = products.filter(p => selectedProducts.includes(p.id));

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

      const response = await api('/api/products/upload-csv', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
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

  const handleCloseReimportModal = () => {
    setShowReimportModal(false);
    setReimportStores([]);
  };

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
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <FileUploadSection
                      files={files}
                      uploading={uploading}
                      onDrop={handleDropZoneDrop}
                      onFileRemove={handleFileRemove}
                    />

                    <StoreSelectionSection
                      stores={stores}
                      selectedStores={selectedStores}
                      files={files}
                      uploading={uploading}
                      onStoresChange={setSelectedStores}
                      onUpload={handleUpload}
                    />

                    <QueueStatusSection
                      queueStats={queueStats}
                      processingQueue={processingQueue}
                      onProcessQueue={handleProcessQueue}
                    />

                    <StoreImportStatusSection storeImportStatus={storeImportStatus} />
                  </div>
                )}

                {selectedTab === 1 && (
                  <ProductsTableSection
                    stores={stores}
                    products={products}
                    loading={loading}
                    selectedStore={selectedStore}
                    selectedProducts={selectedProducts}
                    searchQuery={searchQuery}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    totalProducts={totalProducts}
                    totalPages={totalPages}
                    onStoreChange={setSelectedStore}
                    onSearchChange={setSearchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    onProductSelect={handleProductSelect}
                    onSelectAll={handleSelectAll}
                    onOpenReimportModal={() => setShowReimportModal(true)}
                    onClearSelection={() => setSelectedProducts([])}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={value => {
                      setItemsPerPage(value);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      <ReimportModal
        open={showReimportModal}
        stores={stores}
        selectedProductsCount={selectedProducts.length}
        reimportStores={reimportStores}
        reimporting={reimporting}
        onClose={handleCloseReimportModal}
        onReimportStoresChange={setReimportStores}
        onReimport={handleReimport}
      />
    </Page>
  );
}
