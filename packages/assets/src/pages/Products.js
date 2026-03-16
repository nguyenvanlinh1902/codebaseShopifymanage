import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Banner,
  BlockStack,
  Tabs,
  Card,
  Select,
  InlineStack,
  Text,
  Badge,
  Tooltip
} from '@shopify/polaris';
import {ImportIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import {usePermittedStores} from '../hooks/usePermittedStores';
import useImportProgressAllStores from '../hooks/useImportProgressAllStores';
import ImportProgressCard from './embed-products/ImportProgressCard';
import UploadCsvModal from './products/UploadCsvModal';
import ProductsTableSection from './products/ProductsTableSection';
import ReimportModal from './products/ReimportModal';

/**
 * Products Page - Redesigned to match embed pattern
 * Store filter is shared across all tabs
 */
export default function Products() {
  const {user} = useAuth();
  const {stores, groups, isAdmin} = usePermittedStores();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [lastCompletedId, setLastCompletedId] = useState(null);

  // Selection states
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showReimportModal, setShowReimportModal] = useState(false);
  const [reimportStores, setReimportStores] = useState([]);
  const [reimporting, setReimporting] = useState(false);

  // Real-time import progress (all stores or filtered by selected store)
  const {importHistory} = useImportProgressAllStores({
    userId: user?.id,
    storeId: selectedStore || undefined
  });

  // Watch importHistory for progress updates and completion
  useEffect(() => {
    if (!importHistory.length) {
      setImportProgress(null);
      return;
    }

    const latest = importHistory[0];

    if (latest.status === 'pending' || latest.status === 'processing') {
      const total = latest.totalProducts || 0;
      const processed = latest.processedProducts || 0;
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

      setImportProgress({
        jobId: latest.id,
        status: latest.status,
        fileName: latest.fileName,
        storeName: latest.storeName,
        totalProducts: total,
        totalVariants: latest.totalVariants || 0,
        processedProducts: processed,
        processedVariants: latest.processedVariants || 0,
        successCount: latest.successCount || 0,
        failedCount: latest.failedCount || 0,
        completionPercentage: pct
      });
    }

    const isComplete =
      latest.status === 'completed' || latest.status === 'partial' || latest.status === 'failed';

    if (isComplete && lastCompletedId !== latest.id) {
      setLastCompletedId(latest.id);
      setTimeout(() => setImportProgress(null), 3000);
      fetchProducts();
    }
  }, [importHistory]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const prevStoreRef = React.useRef(selectedStore);
  useEffect(() => {
    if (prevStoreRef.current !== selectedStore) {
      prevStoreRef.current = selectedStore;
      if (currentPage !== 1) {
        setCurrentPage(1);
        return; // will re-trigger with page=1
      }
    }
    fetchProducts();
  }, [selectedStore, currentPage, itemsPerPage]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({page: currentPage, limit: itemsPerPage});
      if (selectedStore) params.append('storeId', selectedStore);

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
      setSuccessMessage(null);

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
        body: JSON.stringify({storeIds: selectedStores, csvFiles})
      });
      const result = await response.json();

      if (result.success) {
        const jobs = result.data.importResults || [];
        const totalProducts = jobs.reduce((sum, j) => sum + (j.totalProducts || 0), 0);
        setFiles([]);
        setSelectedStores([]);
        setUploadModalOpen(false);
        await fetchProducts();

        setSuccessMessage(
          `Import started! ${totalProducts} products queued for ${jobs.length} store(s). Progress will be shown below.`
        );
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
        setSuccessMessage('Products re-imported successfully!');
        await fetchProducts();
      } else {
        setError(result.error || 'Failed to reimport products');
      }
    } catch (err) {
      setError('Failed to reimport products');
    } finally {
      setReimporting(false);
    }
  };

  const handleCloseUploadModal = () => {
    if (!uploading) {
      setUploadModalOpen(false);
      setFiles([]);
      setSelectedStores([]);
    }
  };

  const storeOptions = [
    {label: 'All Stores', value: ''},
    ...stores.map(store => ({label: `${store.name} (${store.shopDomain})`, value: store.id}))
  ];

  const tabs = [
    {id: 'products', content: 'Products', panelID: 'products-panel'},
    {
      id: 'history',
      content: `Import History${importHistory.length > 0 ? ` (${importHistory.length})` : ''}`,
      panelID: 'history-panel'
    }
  ];

  return (
    <Page
      title="Product Management"
      fullWidth
      subtitle="Import products from CSV to multiple Shopify stores"
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

        <ImportProgressCard importProgress={importProgress} />

        {/* Store filter - shared across all tabs */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingSm" as="h3">
              Filter by Store
            </Text>
            <div style={{minWidth: '300px'}}>
              <Select
                label="Store"
                labelHidden
                options={storeOptions}
                value={selectedStore}
                onChange={setSelectedStore}
              />
            </div>
          </InlineStack>
        </Card>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {selectedTab === 0 && (
            <Card>
              <ProductsTableSection
                stores={stores}
                products={products}
                loading={loading}
                selectedStore={selectedStore}
                selectedProducts={selectedProducts}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalProducts={totalProducts}
                totalPages={totalPages}
                onStoreChange={setSelectedStore}
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
            </Card>
          )}

          {selectedTab === 1 && (
            <BlockStack gap="400">
              {/* Import History Records */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h2">
                      Import History
                    </Text>
                    {importHistory.length > 0 && <Badge>{importHistory.length} records</Badge>}
                  </InlineStack>

                  {importHistory.length === 0 ? (
                    <Text tone="subdued">
                      No import history yet. Import products from CSV to see history here.
                    </Text>
                  ) : (
                    <BlockStack gap="300">
                      {importHistory.map(imp => (
                        <Card key={imp.id}>
                          <BlockStack gap="200">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="bodyMd" fontWeight="semibold">
                                {imp.fileName || 'Unknown file'}
                              </Text>
                              {imp.status === 'failed' && imp.error ? (
                                <Tooltip content={imp.error} preferredPosition="above">
                                  <Badge tone="critical">{imp.status}</Badge>
                                </Tooltip>
                              ) : (
                                <Badge
                                  tone={
                                    imp.status === 'completed'
                                      ? 'success'
                                      : imp.status === 'failed'
                                      ? 'critical'
                                      : imp.status === 'processing'
                                      ? 'attention'
                                      : 'info'
                                  }
                                >
                                  {imp.status}
                                </Badge>
                              )}
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text variant="bodySm" tone="subdued">
                                {imp.storeName || 'Unknown store'}
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                {imp.createdAt ? new Date(imp.createdAt).toLocaleString() : '-'}
                              </Text>
                              {(imp.totalProducts || 0) > 0 && (
                                <Text variant="bodySm" tone="subdued">
                                  {imp.totalProducts} products
                                </Text>
                              )}
                              {(imp.successCount || imp.results?.successCount || 0) > 0 && (
                                <Text variant="bodySm" tone="success">
                                  {imp.successCount || imp.results?.successCount || 0} success
                                </Text>
                              )}
                              {(imp.failedCount || 0) > 0 && (
                                <Text variant="bodySm" tone="critical">
                                  {imp.failedCount} failed
                                </Text>
                              )}
                            </InlineStack>
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          )}
        </Tabs>
      </BlockStack>

      <UploadCsvModal
        open={uploadModalOpen}
        onClose={handleCloseUploadModal}
        files={files}
        onDrop={handleDropZoneDrop}
        onRemove={handleFileRemove}
        onUpload={handleUpload}
        onDownloadTemplate={handleDownloadTemplate}
        uploading={uploading}
        stores={stores.filter(s => s.status === 'active')}
        selectedStores={selectedStores}
        onStoresChange={setSelectedStores}
        groups={groups}
        isAdmin={isAdmin}
      />

      <ReimportModal
        open={showReimportModal}
        stores={stores.filter(s => s.status === 'active')}
        selectedProductsCount={selectedProducts.length}
        reimportStores={reimportStores}
        reimporting={reimporting}
        onClose={() => {
          setShowReimportModal(false);
          setReimportStores([]);
        }}
        onReimportStoresChange={setReimportStores}
        onReimport={handleReimport}
      />
    </Page>
  );
}
