import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  BlockStack,
  Card,
  Select,
  IndexFilters,
  useSetIndexFiltersMode,
  Banner
} from '@shopify/polaris';
import {ImportIcon} from '@shopify/polaris-icons';
import {useSearchParams} from 'react-router-dom';
import {api} from '../helpers/api';
import {uploadCsvFiles} from '../helpers/storage-upload';
import {usePermittedStores} from '../hooks/usePermittedStores';
import useImportProgress from '../hooks/useImportProgress';
import ProductsTableSection from './products/ProductsTableSection';
import ImportProgressCard from './embed-products/ImportProgressCard';
import UploadCsvModal from './products/UploadCsvModal';

const STATUS_TABS = [
  {content: 'All', id: 'all', index: 0},
  {content: 'Active', id: 'active', index: 1},
  {content: 'Draft', id: 'draft', index: 2},
  {content: 'Archived', id: 'archived', index: 3}
];

const SORT_OPTIONS = [
  {label: 'Product title', value: 'TITLE asc', directionLabel: 'A-Z'},
  {label: 'Product title', value: 'TITLE desc', directionLabel: 'Z-A'},
  {label: 'Created', value: 'CREATED_AT asc', directionLabel: 'Oldest first'},
  {label: 'Created', value: 'CREATED_AT desc', directionLabel: 'Newest first'},
  {label: 'Updated', value: 'UPDATED_AT asc', directionLabel: 'Oldest first'},
  {label: 'Updated', value: 'UPDATED_AT desc', directionLabel: 'Newest first'},
  {label: 'Inventory', value: 'INVENTORY_TOTAL asc', directionLabel: 'Low to high'},
  {label: 'Inventory', value: 'INVENTORY_TOTAL desc', directionLabel: 'High to low'}
];

export default function Products() {
  const {stores, groups, isAdmin} = usePermittedStores();
  const [searchParams, setSearchParams] = useSearchParams();
  const {mode, setMode} = useSetIndexFiltersMode();

  const [selectedStore, setSelectedStore] = useState(() => searchParams.get('store') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [sortSelected, setSortSelected] = useState(['TITLE asc']);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);

  // Import state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importProgress, setImportProgress] = useState(null);

  // Real-time import progress (tracks active imports for selected store)
  const {importHistory} = useImportProgress({storeId: selectedStore});
  const [lastCompletedId, setLastCompletedId] = useState(null);

  useEffect(() => {
    if (!importHistory.length) return;
    const latest = importHistory[0];

    if (latest.status === 'pending' || latest.status === 'processing') {
      const total = latest.totalProducts || 0;
      const processed = latest.processedProducts || 0;
      setImportProgress({
        jobId: latest.id,
        status: latest.status,
        fileName: latest.fileName,
        totalProducts: total,
        totalVariants: latest.totalVariants || 0,
        processedProducts: processed,
        processedVariants: latest.processedVariants || 0,
        successCount: latest.successCount || 0,
        failedCount: latest.failedCount || 0,
        completionPercentage: total > 0 ? Math.round((processed / total) * 100) : 0
      });
    }

    const isComplete = latest.status === 'completed' || latest.status === 'partial' || latest.status === 'failed';
    if (isComplete && lastCompletedId !== latest.id) {
      setLastCompletedId(latest.id);
      setTimeout(() => setImportProgress(null), 3000);

      if (latest.status === 'completed') {
        setSuccessMessage(`Import complete: ${latest.successCount || 0} products imported successfully.`);
      } else if (latest.status === 'failed') {
        const errMsg = latest.error || latest.statusMessage || `${latest.failedCount || 0} products could not be imported`;
        setError(`Import failed: ${errMsg}`);
      } else {
        setSuccessMessage(`Import partial: ${latest.successCount || 0} success, ${latest.failedCount || 0} failed.`);
      }
      fetchProducts(null);
    }
  }, [importHistory]);

  // Cursor pagination
  const cursorStackRef = useRef([]);
  const [cursor, setCursor] = useState(null);
  const hasPrev = cursorStackRef.current.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      cursorStackRef.current = [];
      setCursor(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const statusFilter = selectedTab > 0 ? STATUS_TABS[selectedTab].id : '';
  const [sortKey, sortDir] = sortSelected[0].split(' ');

  const fetchProducts = useCallback(async (afterCursor = null) => {
    if (!selectedStore) {
      setProducts([]);
      setPageInfo(null);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({storeId: selectedStore, first: '50'});
      params.append('sortKey', sortKey);
      if (sortDir === 'desc') params.append('reverse', 'true');

      const queryParts = [];
      if (debouncedSearch) queryParts.push(debouncedSearch);
      if (statusFilter) queryParts.push(`status:${statusFilter}`);
      if (queryParts.length > 0) params.append('query', queryParts.join(' '));
      if (afterCursor) params.append('after', afterCursor);

      const response = await api(`/api/shopify-products/list?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setProducts(result.data.products || []);
        setPageInfo(result.data.pageInfo || null);
      } else {
        setError(result.error || 'Failed to load products');
      }
    } catch (err) {
      setError('Failed to load products. Check console for details.');
      console.error('[Products] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, debouncedSearch, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    cursorStackRef.current = [];
    setCursor(null);
    fetchProducts(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, debouncedSearch, statusFilter, sortKey, sortDir]);

  const resetPagination = () => {
    cursorStackRef.current = [];
    setCursor(null);
  };

  const handleStoreChange = useCallback(value => {
    setSelectedStore(value);
    setSearchParams(value ? {store: value} : {});
    resetPagination();
  }, [setSearchParams]);

  const handleTabChange = useCallback(index => {
    setSelectedTab(index);
    resetPagination();
  }, []);

  const handleSortChange = useCallback(value => {
    setSortSelected(value);
    resetPagination();
  }, []);

  const handleNextPage = useCallback(() => {
    if (!pageInfo?.endCursor) return;
    cursorStackRef.current.push(cursor);
    setCursor(pageInfo.endCursor);
    fetchProducts(pageInfo.endCursor);
  }, [pageInfo, cursor, fetchProducts]);

  const handlePrevPage = useCallback(() => {
    const prev = cursorStackRef.current.pop();
    setCursor(prev || null);
    fetchProducts(prev || null);
  }, [fetchProducts]);

  // --- Import handlers ---
  const handleDropZoneDrop = useCallback((_drop, accepted) => {
    setFiles(prev => [...prev, ...accepted]);
    setError(null);
  }, []);

  const handleFileRemove = useCallback(index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (selectedStores.length === 0 || files.length === 0) return;
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      // Step 1: Upload files to Firebase Storage
      const {batchId, fileNames} = await uploadCsvFiles(files, {
        onProgress: ({fileName, overall}) => {
          setUploadProgress(Math.round(overall));
          setUploadingFileName(fileName);
        }
      });

      // Step 2: POST metadata only (no CSV content in body)
      setUploadingFileName('Processing...');
      setUploadProgress(100);

      const response = await api('/api/products/upload-csv', {
        method: 'POST',
        body: JSON.stringify({
          batchId,
          fileNames,
          storeIds: selectedStores,
          overwriteExisting
        })
      });

      const result = await response.json();
      if (result.success) {
        const {mergedProductCount, duplicatesRemoved, storesCount} = result.data;
        const dupeMsg = duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicates merged)` : '';
        setFiles([]);
        setSelectedStores([]);
        setUploadModalOpen(false);
        setSuccessMessage(
          `Import started! ${mergedProductCount} products${dupeMsg} queued for ${storesCount} store(s).`
        );
        fetchProducts(null);
      } else {
        setError(result.error || 'Import failed');
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
    } catch {
      setError('Failed to download template');
    }
  };

  const handleCloseModal = () => {
    if (!uploading) {
      setUploadModalOpen(false);
      setFiles([]);
      setSelectedStores([]);
    }
  };

  const storeOptions = [
    {label: 'Select a store', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  return (
    <Page
      title="Products"
      fullWidth
      primaryAction={{content: 'Import', icon: ImportIcon, onAction: () => setUploadModalOpen(true)}}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        {successMessage && <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Banner>}

        <ImportProgressCard importProgress={importProgress} />

        <div style={{maxWidth: 300, width: '100%'}}>
          <Select label="Store" labelHidden options={storeOptions} value={selectedStore} onChange={handleStoreChange} />
        </div>

        <Card padding="0">
          <IndexFilters
            queryValue={searchQuery}
            queryPlaceholder="Search products"
            onQueryChange={setSearchQuery}
            onQueryClear={() => setSearchQuery('')}
            sortOptions={SORT_OPTIONS}
            sortSelected={sortSelected}
            onSort={handleSortChange}
            tabs={STATUS_TABS}
            selected={selectedTab}
            onSelect={handleTabChange}
            canCreateNewView={false}
            filters={[]}
            appliedFilters={[]}
            onClearAll={() => {}}
            mode={mode}
            setMode={setMode}
            cancelAction={{onAction: () => { setSearchQuery(''); setMode('DEFAULT'); }}}
          />
          <ProductsTableSection
            products={products}
            loading={loading}
            pageInfo={pageInfo}
            hasPrev={hasPrev}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
          />
        </Card>
      </BlockStack>

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
        stores={stores.filter(s => s.status === 'active')}
        selectedStores={selectedStores}
        onStoresChange={setSelectedStores}
        groups={groups}
        isAdmin={isAdmin}
        overwriteExisting={overwriteExisting}
        onOverwriteChange={setOverwriteExisting}
      />
    </Page>
  );
}
