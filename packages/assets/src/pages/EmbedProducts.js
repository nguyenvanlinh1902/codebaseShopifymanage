import React, {useState, useEffect, useCallback} from 'react';
import {Page, Banner, BlockStack, Tabs} from '@shopify/polaris';
import {ImportIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {uploadCsvFiles} from '../helpers/storage-upload';
import useImportProgress from '../hooks/useImportProgress';
import ImportProgressCard from './embed-products/ImportProgressCard';
import ProductsTab from './embed-products/ProductsTab';
import ImportHistoryTab from './embed-products/ImportHistoryTab';
import ImportDetailModal from './embed-products/ImportDetailModal';
import UploadCsvModal from './embed-products/UploadCsvModal';

export default function EmbedProducts() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [storeId, setStoreId] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [detailModal, setDetailModal] = useState(null);

  const fetchProducts = useCallback(async () => {
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
  }, [currentPage, itemsPerPage, debouncedSearch]);

  // Real-time import progress
  const {importHistory} = useImportProgress({storeId});
  const [lastCompletedId, setLastCompletedId] = useState(null);

  // Watch importHistory for progress updates and completion
  useEffect(() => {
    if (!importHistory.length) return;

    const latest = importHistory[0];

    // Update progress bar for active imports
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

    // Detect completion
    const isComplete =
      latest.status === 'completed' || latest.status === 'partial' || latest.status === 'failed';

    if (isComplete && lastCompletedId !== latest.id) {
      setLastCompletedId(latest.id);
      setTimeout(() => setImportProgress(null), 3000);

      if (latest.status === 'completed') {
        setSuccessMessage(
          `Import complete: ${latest.successCount || 0} products imported successfully.`
        );
      } else if (latest.status === 'partial') {
        setSuccessMessage(
          `Import partially complete: ${latest.successCount || 0} imported, ${latest.failedCount ||
            0} failed.`
        );
      } else {
        setError(`Import failed: ${latest.failedCount || 0} products could not be imported.`);
      }

      // Refetch products
      setCurrentPage(1);
      fetchProducts();
    }
  }, [importHistory]);

  const tabs = [
    {id: 'products', content: 'Products', panelID: 'products-panel'},
    {
      id: 'history',
      content: `Import History${importHistory.length > 0 ? ` (${importHistory.length})` : ''}`,
      panelID: 'history-panel'
    },
  ];

  useEffect(() => {
    const fetchStoreInfo = async () => {
      try {
        const response = await api('/api/embed/store');
        const result = await response.json();
        if (result.success && result.data) setStoreId(result.data.id);
      } catch (err) {
        console.error('Error fetching store info:', err);
      }
    };
    fetchStoreInfo();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 1000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const handleFileRemove = useCallback(index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;
    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);
      setUploadProgress(0);

      // Upload files to Storage via signed URLs
      const {batchId, fileNames} = await uploadCsvFiles(files, {
        onProgress: ({fileName, overall}) => {
          setUploadProgress(Math.round(overall));
          setUploadingFileName(fileName);
        }
      });

      setUploadingFileName('Processing...');
      setUploadProgress(100);

      const response = await api('/api/embed/products/upload-csv', {
        method: 'POST',
        body: JSON.stringify({batchId, fileNames, overwriteExisting})
      });

      const result = await response.json();
      if (result.success) {
        const jobs = result.data.importResults || [];
        setFiles([]);
        setUploadModalOpen(false);
        if (jobs.length > 0 && jobs[0].storeId && !storeId) setStoreId(jobs[0].storeId);
        setSuccessMessage('Import started! Progress will be shown below.');
      } else {
        let errorMsg = result.error || 'Import failed';
        if (result.fileErrors) {
          errorMsg += '\n' + result.fileErrors.map(fe => `${fe.fileName}: ${fe.error}`).join('\n');
        }
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload CSV files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
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

        <ImportProgressCard importProgress={importProgress} />

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {selectedTab === 0 && (
            <ProductsTab
              products={products}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalProducts={totalProducts}
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              onImportClick={() => setUploadModalOpen(true)}
            />
          )}

          {selectedTab === 1 && (
            <ImportHistoryTab importHistory={importHistory} onViewDetails={setDetailModal} />
          )}

        </Tabs>
      </BlockStack>

      <ImportDetailModal detail={detailModal} onClose={() => setDetailModal(null)} />

      <UploadCsvModal
        open={uploadModalOpen}
        onClose={handleCloseModal}
        files={files}
        onDrop={handleDropZoneDrop}
        onRemove={handleFileRemove}
        onUpload={handleUpload}
        onDownloadTemplate={handleDownloadTemplate}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadingFileName={uploadingFileName}
        overwriteExisting={overwriteExisting}
        onOverwriteChange={setOverwriteExisting}
      />
    </Page>
  );
}
