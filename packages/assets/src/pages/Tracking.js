import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  Layout,
  Card,
  Banner,
  Select,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Modal,
  InlineGrid,
  SkeletonBodyText,
  Divider,
  Badge,
  ChoiceList
} from '@shopify/polaris';
import {ImportIcon, ClockIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import {useTrackingStatusApi} from '../hooks/use-tracking-status-api';
import useRecheckProgress from '../hooks/use-recheck-progress';
import ExcelUploadTab from './tracking/ExcelUploadTab';
import ImportHistoryTable from './tracking/ImportHistoryTable';
import ImportDetailsModal from './tracking/ImportDetailsModal';
import StatusListTab from './tracking-status/StatusListTab';

// ============ Dashboard Stats Section ============
function StatCard({label, value, tone}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" tone="subdued">
          {label}
        </Text>
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" fontWeight="bold">
            {value ?? '—'}
          </Text>
          {tone && <Badge tone={tone}>{label}</Badge>}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

const STAT_CARDS = [
  {key: 'total', label: 'Total', tone: undefined},
  {key: 'info_received', label: 'Info Received', tone: 'info'},
  {key: 'in_transit', label: 'In Transit', tone: 'info'},
  {key: 'delivered', label: 'Delivered', tone: 'success'},
  {key: 'pending', label: 'Pending', tone: 'attention'},
  {key: 'not_found', label: 'Not Found', tone: 'warning'},
  {key: 'alert', label: 'Alert', tone: 'critical'}
];

/**
 * Tracking Dashboard
 * Combined page: stats overview + import tracking + tracking records
 */
export default function Tracking() {
  const {stores, groups, loading} = usePermittedStores();

  const trackingApi = useTrackingStatusApi();
  const [triggering, setTriggering] = useState(false);

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStore, setImportStore] = useState('');

  // Import history
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [importPagination, setImportPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [importPage, setImportPage] = useState(1);
  const [importPerPage, setImportPerPage] = useState(10);
  const [importSearch, setImportSearch] = useState('');
  const [importFetching, setImportFetching] = useState(false);

  // Recheck modal + progress
  const [recheckModalOpen, setRecheckModalOpen] = useState(false);
  const [recheckStatuses, setRecheckStatuses] = useState(['pending', 'in_transit', 'not_found']);
  const [recheckJobId, setRecheckJobId] = useState(null);
  const {job: recheckJob, clearJob: clearRecheckJob} = useRecheckProgress(recheckJobId);

  // Excel state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Tracking history
  const [historyStatuses, setHistoryStatuses] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState('all');
  const [historyStore, setHistoryStore] = useState('');
  const [historyGroup, setHistoryGroup] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyPagination, setHistoryPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPerPage, setHistoryPerPage] = useState(10);
  const [historySearch, setHistorySearch] = useState('');

  // Feedback
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch tracking history (statuses from Firestore)
  const storesRef = useRef(stores);
  const groupsRef = useRef(groups);
  storesRef.current = stores;
  groupsRef.current = groups;

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams({
      page: historyPage,
      perPage: historyPerPage,
      search: historySearch
    });
    if (historyStatusFilter === '__stale__') {
      params.set('stale', '1');
    } else if (historyStatusFilter) {
      params.set('status', historyStatusFilter);
    }

    if (historyFilterType === 'all') {
      params.set('all', 'true');
    } else if (historyFilterType === 'store' && historyStore) {
      params.set('storeId', historyStore);
    } else if (historyFilterType === 'group' && historyGroup) {
      const group = groupsRef.current.find(g => g.id === historyGroup);
      const ids = storesRef.current
        .filter(s => s.groupId === historyGroup || s.group === group?.name)
        .map(s => s.id);
      if (!ids.length) {
        setHistoryStatuses([]);
        return;
      }
      params.set('storeIds', ids.join(','));
    } else {
      return;
    }

    try {
      setHistoryLoading(true);
      const res = await api(`/api/tracking-status/statuses?${params}`);
      const data = await res.json();
      if (data.success) {
        setHistoryStatuses(data.data);
        if (data.pagination) setHistoryPagination(data.pagination);
      }
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }, [
    historyFilterType,
    historyStore,
    historyGroup,
    historyStatusFilter,
    historyPage,
    historyPerPage,
    historySearch
  ]);

  // Single effect: fetch + auto-reset page when filters change
  const historyFiltersRef = useRef({
    historyFilterType, historyStore, historyGroup,
    historyStatusFilter, historyPerPage, historySearch
  });
  useEffect(() => {
    const prev = historyFiltersRef.current;
    const filtersChanged =
      prev.historyFilterType !== historyFilterType ||
      prev.historyStore !== historyStore ||
      prev.historyGroup !== historyGroup ||
      prev.historyStatusFilter !== historyStatusFilter ||
      prev.historyPerPage !== historyPerPage ||
      prev.historySearch !== historySearch;
    historyFiltersRef.current = {
      historyFilterType, historyStore, historyGroup,
      historyStatusFilter, historyPerPage, historySearch
    };

    if (filtersChanged && historyPage !== 1) {
      setHistoryPage(1);
      return;
    }

    if (
      historyFilterType === 'all' ||
      (historyFilterType === 'store' && historyStore) ||
      (historyFilterType === 'group' && historyGroup)
    ) {
      fetchHistory();
    }
  }, [
    historyPage, historyPerPage, historySearch,
    historyFilterType, historyStore, historyGroup,
    historyStatusFilter
  ]);

  // Auto-select first store for import
  useEffect(() => {
    if (stores.length > 0 && !importStore) setImportStore(stores[0].id);
  }, [stores]);

  useEffect(() => {
    trackingApi.fetchStats();
  }, [trackingApi.fetchStats]);

  const handleRecheck = async selectedStatuses => {
    try {
      setTriggering(true);
      setError(null);
      setSuccessMessage(null);
      const d = await trackingApi.triggerRecheck(selectedStatuses);
      if (d.jobId) {
        setRecheckJobId(d.jobId);
      } else {
        setSuccessMessage('No trackings to recheck');
        setTriggering(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to trigger recheck');
      setTriggering(false);
    }
  };

  // When recheck job completes, refresh data
  useEffect(() => {
    if (!recheckJob || recheckJob.status !== 'completed') return;
    setTriggering(false);
    setSuccessMessage(
      `Recheck complete: ${recheckJob.totalRegistered || 0} registered, ` +
        `${recheckJob.totalQueried || 0} queried, ${recheckJob.totalUpdated || 0} updated`
    );
    trackingApi.fetchStats();
    fetchHistory();
    const timer = setTimeout(() => {
      setRecheckJobId(null);
      clearRecheckJob();
    }, 8000);
    return () => clearTimeout(timer);
  }, [recheckJob?.status]);

  const handleClearInvalid = async () => {
    try {
      setError(null);
      const d = await trackingApi.clearInvalid();
      setSuccessMessage(`Cleared ${d.deleted} invalid tracking(s)`);
      fetchHistory();
      trackingApi.fetchStats();
    } catch (err) {
      setError(err.message || 'Failed to clear invalid trackings');
    }
  };

  // Fetch import history
  const fetchImportHistory = async () => {
    try {
      setImportFetching(true);
      const params = new URLSearchParams({
        page: importPage,
        perPage: importPerPage,
        search: importSearch
      });
      if (importStore) params.set('storeId', importStore);
      const res = await api(`/api/tracking/import-history?${params}`);
      const data = await res.json();
      if (data.success) {
        setImportHistory(data.data);
        if (data.pagination) setImportPagination(data.pagination);
      }
    } catch {
      /* silent */
    } finally {
      setImportFetching(false);
    }
  };

  // Single effect: fetch + auto-reset page when filters change
  const importFiltersRef = useRef({importStore, importPerPage, importSearch});
  useEffect(() => {
    const prev = importFiltersRef.current;
    const filtersChanged =
      prev.importStore !== importStore ||
      prev.importPerPage !== importPerPage ||
      prev.importSearch !== importSearch;
    importFiltersRef.current = {importStore, importPerPage, importSearch};

    if (filtersChanged && importPage !== 1) {
      setImportPage(1);
      return;
    }
    fetchImportHistory();
  }, [importPage, importPerPage, importSearch, importStore]);

  // Keep a ref to the latest fetchImportHistory for polling
  const fetchImportHistoryRef = useRef(fetchImportHistory);
  fetchImportHistoryRef.current = fetchImportHistory;

  // Auto-refresh while jobs are processing
  useEffect(() => {
    const hasProcessing = importHistory.some(
      i => i.status === 'processing' || i.status === 'pending'
    );
    if (!hasProcessing) return;
    const id = setInterval(() => {
      fetchImportHistoryRef.current();
    }, 3000);
    return () => clearInterval(id);
  }, [importHistory]);

  // Polling after import
  const pollRef = useRef(null);
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    let count = 0;
    pollRef.current = setInterval(() => {
      fetchImportHistoryRef.current();
      count++;
      if (count >= 10) clearInterval(pollRef.current);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDropZoneDrop = useCallback((_drop, accepted) => {
    setFile(accepted[0]);
    setError(null);
  }, []);

  const handleUpload = async () => {
    if (!importStore) {
      setError('Please select a store first');
      return;
    }
    if (!file) {
      setError('Please upload an Excel file first');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);
      const reader = new FileReader();
      reader.onload = async e => {
        const res = await api('/api/tracking/upload-excel', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            storeId: importStore,
            excelBuffer: e.target.result.split(',')[1],
            fileName: file.name
          })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMessage(data.message);
          setFile(null);
          setImportModalOpen(false);
          startPolling();
        } else setError(data.error || 'Failed to upload file');
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Failed to upload file');
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api('/api/tracking/template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tracking-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download template');
    }
  };

  // Options
  const importStoreOptions = [
    {label: 'Select store', value: ''},
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const statusStats = trackingApi.stats?.statuses || {};

  return (
    <Page
      title="Tracking Dashboard"
      fullWidth
      subtitle="Overview, import tracking, and manage tracking records"
      primaryAction={{
        content: 'Import Tracking',
        icon: ImportIcon,
        onAction: () => {
          setImportModalOpen(true);
          setError(null);
          setSuccessMessage(null);
        }
      }}
      secondaryActions={[
        {
          content: 'Import History',
          icon: ClockIcon,
          onAction: () => {
            setHistoryModalOpen(true);
            fetchImportHistory();
          }
        }
      ]}
    >
      <Layout>
        {error && !importModalOpen && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Banner>
          </Layout.Section>
        )}

        {/* Recheck Progress */}
        {recheckJob && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    {recheckJob.status === 'completed' ? 'Recheck Complete' : 'Rechecking...'}
                  </Text>
                  <Badge tone={recheckJob.status === 'completed' ? 'success' : 'attention'}>
                    {recheckJob.totalGroups
                      ? Math.round((recheckJob.processedGroups / recheckJob.totalGroups) * 100)
                      : 0}
                    %
                  </Badge>
                </InlineStack>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e4e5e7',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${recheckJob.totalGroups ? Math.round((recheckJob.processedGroups / recheckJob.totalGroups) * 100) : 0}%`,
                      height: '100%',
                      backgroundColor: '#008060',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <InlineStack gap="400">
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.processedGroups}/{recheckJob.totalGroups} groups
                  </Text>
                  <Text variant="bodySm" tone="success">
                    {recheckJob.totalUpdated || 0} updated
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.totalRegistered || 0} registered
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.totalQueried || 0} queried
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Stats Overview */}
        <Layout.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" fontWeight="semibold">
                Status Overview
              </Text>
              <InlineStack gap="300">
                <Button
                  onClick={trackingApi.fetchStats}
                  disabled={trackingApi.statsLoading}
                  size="slim"
                >
                  Refresh Stats
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setRecheckModalOpen(true)}
                  loading={triggering}
                  size="slim"
                >
                  Recheck All
                </Button>
              </InlineStack>
            </InlineStack>
            {trackingApi.statsLoading && !trackingApi.stats ? (
              <SkeletonBodyText lines={2} />
            ) : (
              <InlineGrid columns={{xs: 2, sm: 3, md: 6}} gap="300">
                {STAT_CARDS.map(({key, label, tone}) => (
                  <StatCard key={key} label={label} value={statusStats[key]} tone={tone} />
                ))}
              </InlineGrid>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <Divider />
        </Layout.Section>

        {/* Tracking History (from 17TRACK checks) */}
        <Layout.Section>
          <BlockStack gap="300">
            <Text variant="headingMd" fontWeight="semibold">
              Tracking History
            </Text>
            <StatusListTab
              statuses={historyStatuses}
              loading={historyLoading}
              statusFilter={historyStatusFilter}
              onFilterChange={setHistoryStatusFilter}
              onRefresh={fetchHistory}
              onRecheck={handleRecheck}
              recheckLoading={triggering}
              onClearInvalid={handleClearInvalid}
              stores={stores}
              groups={groups}
              filterType={historyFilterType}
              onFilterTypeChange={setHistoryFilterType}
              selectedStore={historyStore}
              onStoreChange={setHistoryStore}
              selectedGroup={historyGroup}
              onGroupChange={setHistoryGroup}
              pagination={historyPagination}
              page={historyPage}
              perPage={historyPerPage}
              search={historySearch}
              onPageChange={setHistoryPage}
              onPerPageChange={setHistoryPerPage}
              onSearchChange={setHistorySearch}
            />
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Import Modal */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Tracking"
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
            {error && importModalOpen && (
              <Banner tone="critical" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            )}
            <div style={{minWidth: '240px', maxWidth: '400px'}}>
              <Select
                label="Target Store"
                options={importStoreOptions}
                value={importStore}
                onChange={setImportStore}
                disabled={loading}
              />
            </div>
            <ExcelUploadTab
              file={file}
              uploading={uploading}
              onDropZoneDrop={handleDropZoneDrop}
              onUpload={handleUpload}
              onDownloadTemplate={handleDownloadTemplate}
              onFileRemove={() => setFile(null)}
              canUpload={!!importStore}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Import History Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Import History"
        large
      >
        <Modal.Section>
          <ImportHistoryTable
            importHistory={importHistory}
            loading={importFetching}
            onViewDetails={imp => {
              setSelectedImport(imp);
              setShowDetailsModal(true);
              setHistoryModalOpen(false);
            }}
            onRefresh={fetchImportHistory}
            pagination={importPagination}
            page={importPage}
            perPage={importPerPage}
            search={importSearch}
            onPageChange={setImportPage}
            onPerPageChange={setImportPerPage}
            onSearchChange={setImportSearch}
          />
        </Modal.Section>
      </Modal>

      <ImportDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setHistoryModalOpen(true);
        }}
        selectedImport={selectedImport}
      />

      <Modal
        open={recheckModalOpen}
        onClose={() => setRecheckModalOpen(false)}
        title="Recheck Tracking Status"
        primaryAction={{
          content: `Recheck (${recheckStatuses.length} status${
            recheckStatuses.length !== 1 ? 'es' : ''
          })`,
          onAction: () => {
            handleRecheck(recheckStatuses);
            setRecheckModalOpen(false);
          },
          loading: triggering,
          disabled: recheckStatuses.length === 0
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setRecheckModalOpen(false)}]}
      >
        <Modal.Section>
          <ChoiceList
            allowMultiple
            title="Select statuses to recheck via 17TRACK"
            choices={[
              {label: 'Pending', value: 'pending'},
              {label: 'Info Received', value: 'info_received'},
              {label: 'In Transit', value: 'in_transit'},
              {label: 'Not Found', value: 'not_found'},
              {label: 'Pick Up', value: 'pick_up'},
              {label: 'Undelivered', value: 'undelivered'},
              {label: 'Alert', value: 'alert'}
            ]}
            selected={recheckStatuses}
            onChange={setRecheckStatuses}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
