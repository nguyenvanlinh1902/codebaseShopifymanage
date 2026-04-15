import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  BlockStack,
  Card,
  Select,
  IndexFilters,
  useSetIndexFiltersMode,
  Banner,
  Modal,
  Badge,
  Text,
  InlineStack,
  Button
} from '@shopify/polaris';
import {ImportIcon} from '@shopify/polaris-icons';
import {useSearchParams, useNavigate} from 'react-router-dom';
import {api} from '../helpers/api';
import {uploadCsvFiles} from '../helpers/storage-upload';
import {useAuth} from '../context/AuthContext';
import {usePermittedStores} from '../hooks/usePermittedStores';
import useImportProgressAllStores from '../hooks/useImportProgressAllStores';
import ProductsTableSection from './products/ProductsTableSection';
import UploadCsvModal from './products/UploadCsvModal';
import ImportDetailModal from './embed-products/ImportDetailModal';
import BulkTagModal from './products/BulkTagModal';
import BulkCollectionModal from './products/BulkCollectionModal';

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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTagModal, setBulkTagModal] = useState(null); // {mode, productIds, clearSelection}
  const [bulkCollectionModal, setBulkCollectionModal] = useState(null); // {mode, productIds, clearSelection}
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [retryingIds, setRetryingIds] = useState(new Set());

  // Show delete button only on localhost OR when ?debug=1 in URL
  const isLocalDebug =
    typeof window !== 'undefined' &&
    (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ||
      new URLSearchParams(window.location.search).get('debug') === '1');

  const handleRetryImport = useCallback(async importId => {
    setRetryingIds(prev => new Set(prev).add(importId));
    try {
      // async = publish to PubSub → production worker picks up (no browser timeout)
      const res = await api(`/api/products/imports/${importId}/retry?mode=async`, {method: 'POST'});
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Retry failed');
      if (data.data?.mode === 'async') {
        alert('Retry queued. Worker đang chạy — xem progress real-time ở Import History.');
      } else {
        alert(
          `Retry done. status=${data.data?.status}, ok=${data.data?.successCount ||
            0}, failed=${data.data?.failedCount || 0}`
        );
      }
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(importId);
        return next;
      });
    }
  }, []);

  const handleDeleteImport = useCallback(async importId => {
    if (!window.confirm('Delete this import record? This cannot be undone.')) return;
    setDeletingIds(prev => new Set(prev).add(importId));
    try {
      const res = await api(`/api/products/imports/${importId}`, {method: 'DELETE'});
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(importId);
        return next;
      });
    }
  }, []);

  // Real-time import completion notification
  const {user} = useAuth();
  const {importHistory} = useImportProgressAllStores({userId: user?.id});
  const completedIdsRef = useRef(null);

  useEffect(() => {
    if (!importHistory.length) return;

    // On first load: mark all existing completed jobs
    if (completedIdsRef.current === null) {
      completedIdsRef.current = new Set(
        importHistory
          .filter(j => j.status === 'completed' || j.status === 'partial' || j.status === 'failed')
          .map(j => j.id)
      );
      return;
    }

    // Detect NEWLY completed jobs
    const justCompleted = importHistory.filter(
      j =>
        (j.status === 'completed' || j.status === 'partial' || j.status === 'failed') &&
        !completedIdsRef.current.has(j.id)
    );

    if (justCompleted.length === 0) return;

    for (const job of justCompleted) {
      completedIdsRef.current.add(job.id);
    }

    const totalSuccess = justCompleted.reduce((s, j) => s + (j.successCount || 0), 0);
    const totalFailed = justCompleted.reduce((s, j) => s + (j.failedCount || 0), 0);
    const failedDetails = justCompleted.flatMap(j =>
      (j.failedProductDetails || []).map(d => `• ${d.title}: ${d.message}`)
    );

    const allFailed = justCompleted.every(j => j.status === 'failed');
    if (allFailed) {
      const errMsg =
        justCompleted[0].error || justCompleted[0].statusMessage || 'All products failed';
      setError(
        `Import failed: ${errMsg}${
          failedDetails.length ? '\n' + failedDetails.slice(0, 10).join('\n') : ''
        }`
      );
    } else if (totalFailed > 0) {
      setError(
        `Import: ${totalSuccess} success, ${totalFailed} failed.\n${failedDetails
          .slice(0, 10)
          .join('\n')}`
      );
      if (totalSuccess > 0) setSuccessMessage(`${totalSuccess} products imported successfully.`);
    } else {
      setSuccessMessage(`Import complete: ${totalSuccess} products imported successfully.`);
    }
    fetchProducts(null);
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

  const fetchProducts = useCallback(
    async (afterCursor = null) => {
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
    },
    [selectedStore, debouncedSearch, statusFilter, sortKey, sortDir]
  );

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

  const handleStoreChange = useCallback(
    value => {
      setSelectedStore(value);
      setSearchParams(value ? {store: value} : {});
      resetPagination();
    },
    [setSearchParams]
  );

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

  const executeBulkApi = useCallback(
    async (body, label, clearSelection) => {
      try {
        setBulkLoading(true);
        setError(null);
        const response = await api('/api/shopify-products/bulk-action', {
          method: 'POST',
          body: JSON.stringify({storeId: selectedStore, ...body})
        });
        const result = await response.json();
        if (result.success) {
          const {successCount, failedCount, skippedCount} = result.data;
          const parts = [];
          if (successCount > 0) parts.push(`${successCount} succeeded`);
          if (skippedCount > 0) parts.push(`${skippedCount} already in collection`);
          if (failedCount > 0) parts.push(`${failedCount} failed`);
          if (failedCount > 0) {
            setError(parts.join(', ') + '.');
          } else {
            setSuccessMessage(parts.join(', ') + '.');
          }
          clearSelection();
          fetchProducts(cursor);
        } else {
          setError(result.error || `Failed to ${label} products`);
        }
      } catch (err) {
        setError(err.message || `Failed to ${label} products`);
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedStore, fetchProducts, cursor]
  );

  const handleBulkAction = useCallback(
    (action, productIds, clearSelection) => {
      if (!selectedStore || productIds.length === 0) return;

      // Actions that need a modal
      if (action === 'ADD_TAGS' || action === 'REMOVE_TAGS') {
        setBulkTagModal({
          mode: action === 'ADD_TAGS' ? 'add' : 'remove',
          productIds,
          clearSelection
        });
        return;
      }
      if (action === 'ADD_TO_COLLECTION' || action === 'REMOVE_FROM_COLLECTION') {
        setBulkCollectionModal({
          mode: action === 'ADD_TO_COLLECTION' ? 'add' : 'remove',
          productIds,
          clearSelection
        });
        return;
      }

      // Direct actions with confirmation
      const actionLabels = {
        ACTIVE: 'activate',
        DRAFT: 'set as draft',
        ARCHIVED: 'archive',
        DELETE: 'delete'
      };
      const label = actionLabels[action] || action;
      if (!window.confirm(`Are you sure you want to ${label} ${productIds.length} product(s)?`))
        return;
      executeBulkApi({productIds, action}, label, clearSelection);
    },
    [selectedStore, executeBulkApi]
  );

  const handleBulkTagSubmit = useCallback(
    tags => {
      if (!bulkTagModal) return;
      const {mode, productIds, clearSelection} = bulkTagModal;
      const action = mode === 'add' ? 'ADD_TAGS' : 'REMOVE_TAGS';
      setBulkTagModal(null);
      executeBulkApi({productIds, action, tags}, `${mode} tags`, clearSelection);
    },
    [bulkTagModal, executeBulkApi]
  );

  const handleBulkCollectionSubmit = useCallback(
    collectionId => {
      if (!bulkCollectionModal) return;
      const {mode, productIds, clearSelection} = bulkCollectionModal;
      const action = mode === 'add' ? 'ADD_TO_COLLECTION' : 'REMOVE_FROM_COLLECTION';
      setBulkCollectionModal(null);
      executeBulkApi({productIds, action, collectionId}, `${mode} collection`, clearSelection);
    },
    [bulkCollectionModal, executeBulkApi]
  );

  const storeOptions = [
    {label: 'Select a store', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  return (
    <Page
      title="Products"
      fullWidth
      primaryAction={{
        content: 'Add product',
        onAction: () =>
          navigate(selectedStore ? `/products/new?store=${selectedStore}` : '/products/new')
      }}
      secondaryActions={[
        {content: 'Import', icon: ImportIcon, onAction: () => setUploadModalOpen(true)},
        {content: 'Import History', onAction: () => setHistoryModalOpen(true)}
      ]}
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

        <div style={{maxWidth: 300, width: '100%'}}>
          <Select
            label="Store"
            labelHidden
            options={storeOptions}
            value={selectedStore}
            onChange={handleStoreChange}
          />
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
            cancelAction={{
              onAction: () => {
                setSearchQuery('');
                setMode('DEFAULT');
              }
            }}
          />
          <ProductsTableSection
            products={products}
            loading={bulkLoading || loading}
            pageInfo={pageInfo}
            hasPrev={hasPrev}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            onBulkAction={handleBulkAction}
            onRowClick={p => {
              const numericId = String(p.id).split('/').pop();
              navigate(`/products/${numericId}?store=${selectedStore}`);
            }}
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

      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Import History"
        secondaryActions={[{content: 'Close', onAction: () => setHistoryModalOpen(false)}]}
        large
      >
        <Modal.Section>
          {importHistory.length === 0 ? (
            <Text tone="subdued">No import history yet.</Text>
          ) : (
            <BlockStack gap="300">
              {importHistory.map(imp => (
                <Card key={imp.id}>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {imp.storeName} — {imp.fileName || 'Unknown'}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {imp.createdAt
                            ? new Date(
                                imp.createdAt.seconds ? imp.createdAt.seconds * 1000 : imp.createdAt
                              ).toLocaleString()
                            : '-'}
                        </Text>
                        {imp.status === 'processing' &&
                          (() => {
                            const updatedMs = imp.updatedAt
                              ? new Date(
                                  imp.updatedAt.seconds
                                    ? imp.updatedAt.seconds * 1000
                                    : imp.updatedAt
                                ).getTime()
                              : 0;
                            const ageSec = updatedMs
                              ? Math.floor((Date.now() - updatedMs) / 1000)
                              : 0;
                            const ageLabel =
                              ageSec < 60
                                ? `${ageSec}s ago`
                                : `${Math.floor(ageSec / 60)}m ${ageSec % 60}s ago`;
                            const isStuck = ageSec > 180; // >3 min = likely dead
                            return (
                              <Text variant="bodySm" tone={isStuck ? 'critical' : 'subdued'}>
                                Last update: {ageLabel} {isStuck ? '⚠️ may be stuck' : ''}
                                {imp.statusMessage ? ` — ${imp.statusMessage}` : ''}
                              </Text>
                            );
                          })()}
                      </BlockStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm">
                          {imp.status === 'processing' && (imp.processedProducts || 0) > 0
                            ? `${imp.processedProducts}/${imp.totalProducts || '?'} products`
                            : `${imp.totalProducts || 0} products`}
                        </Text>
                        {(imp.successCount || 0) > 0 && (
                          <Badge tone="success">{imp.successCount} ok</Badge>
                        )}
                        {(imp.failedCount || 0) > 0 && (
                          <Badge tone="critical">{imp.failedCount} failed</Badge>
                        )}
                        <Badge
                          tone={
                            imp.status === 'completed'
                              ? 'success'
                              : imp.status === 'failed'
                              ? 'critical'
                              : 'info'
                          }
                        >
                          {imp.status}
                        </Badge>
                        {(imp.status === 'failed' || (imp.failedCount || 0) > 0) && (
                          <Button
                            size="slim"
                            onClick={() => {
                              setHistoryModalOpen(false);
                              setDetailModal(imp);
                            }}
                          >
                            Details
                          </Button>
                        )}
                        {isLocalDebug && (
                          <>
                            <Button
                              size="slim"
                              variant="plain"
                              loading={retryingIds.has(imp.id)}
                              onClick={() => handleRetryImport(imp.id)}
                            >
                              Retry
                            </Button>
                            <Button
                              size="slim"
                              tone="critical"
                              variant="plain"
                              loading={deletingIds.has(imp.id)}
                              onClick={() => handleDeleteImport(imp.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </InlineStack>
                    </InlineStack>
                    {(imp.duplicateRowCount || 0) > 0 && (
                      <Text variant="bodySm" tone="caution">
                        {imp.duplicateRowCount} duplicate row{imp.duplicateRowCount > 1 ? 's' : ''}{' '}
                        merged into {imp.duplicateHandleCount} existing handle
                        {imp.duplicateHandleCount > 1 ? 's' : ''} → only{' '}
                        {imp.expectedUniqueProducts} unique product
                        {imp.expectedUniqueProducts > 1 ? 's' : ''} created/updated
                        {imp.duplicateSamples?.length > 0 && (
                          <>
                            . Sample:{' '}
                            {imp.duplicateSamples
                              .slice(0, 3)
                              .map(s => `"${s.handle}" x${s.count}`)
                              .join(', ')}
                            {imp.duplicateSamples.length > 3 ? '…' : ''}
                          </>
                        )}
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>

      <ImportDetailModal detail={detailModal} onClose={() => setDetailModal(null)} />

      <BulkTagModal
        open={!!bulkTagModal}
        mode={bulkTagModal?.mode || 'add'}
        productCount={bulkTagModal?.productIds?.length || 0}
        loading={bulkLoading}
        onClose={() => setBulkTagModal(null)}
        onSubmit={handleBulkTagSubmit}
      />

      <BulkCollectionModal
        open={!!bulkCollectionModal}
        mode={bulkCollectionModal?.mode || 'add'}
        storeId={selectedStore}
        productCount={bulkCollectionModal?.productIds?.length || 0}
        loading={bulkLoading}
        onClose={() => setBulkCollectionModal(null)}
        onSubmit={handleBulkCollectionSubmit}
      />
    </Page>
  );
}
