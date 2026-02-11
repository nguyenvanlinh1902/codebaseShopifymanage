import React, { useState, useEffect, useCallback } from 'react';
import { Page, Banner, BlockStack, Tabs } from '@shopify/polaris';
import { ImportIcon } from '@shopify/polaris-icons';
import { api } from '../helpers/api';
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
      const params = new URLSearchParams({ page: currentPage, limit: itemsPerPage });
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
  const { importHistory } = useImportProgress({
    storeId,
    onComplete: async importData => {
      setTimeout(() => setImportProgress(null), 3000);
      await fetchProducts();

      const status = importData.status;
      if (status === 'completed') {
        setSuccessMessage(
          `Import complete: ${importData.successCount || 0} products imported successfully.`
        );
      } else if (status === 'partial') {
        setSuccessMessage(
          `Import partially complete: ${importData.successCount ||
          0} imported, ${importData.failedCount || 0} failed.`
        );
      } else {
        setError(`Import failed: ${importData.failedCount || 0} products could not be imported.`);
      }
    },
    onProgress: importData => {
      const total = importData.totalProducts || 0;
      const processed = importData.processedProducts || 0;
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

      setImportProgress({
        jobId: importData.id,
        status: importData.status,
        fileName: importData.fileName,
        storeName: importData.storeName,
        totalProducts: total,
        processedProducts: processed,
        successCount: importData.successCount || 0,
        failedCount: importData.failedCount || 0,
        skippedCount: importData.skippedCount || 0,
        completionPercentage: pct
      });
    }
  });

  const tabs = [
    { id: 'products', content: 'Products', panelID: 'products-panel' },
    {
      id: 'history',
      content: `Import History${importHistory.length > 0 ? ` (${importHistory.length})` : ''}`,
      panelID: 'history-panel'
    }
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

  const readFileAsText = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });

  const handleUpload = async () => {
    if (files.length === 0) return;
    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

      const csvFiles = [];
      for (const f of files) {
        const csvData = await readFileAsText(f);
        csvFiles.push({ csvData, fileName: f.name });
      }

      const response = await api('/api/embed/products/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvFiles })
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

  return (
    <Page
      title="Products"
      subtitle="Import and manage products from CSV"
      primaryAction={{
        content: 'Import CSV',
        icon: ImportIcon,
        onAction: () => setUploadModalOpen(true)
      }}
      secondaryActions={[{ content: 'Download Template', onAction: handleDownloadTemplate }]}
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
      />
    </Page>
  );
}
