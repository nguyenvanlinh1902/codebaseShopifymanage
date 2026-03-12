import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page, Layout, Card, Banner, Select, BlockStack, Text,
  Button, InlineStack, Modal, InlineGrid, SkeletonBodyText,
  Divider, Badge
} from '@shopify/polaris';
import {ImportIcon, ClockIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import ExcelUploadTab from './tracking/ExcelUploadTab';
import ImportHistoryTable from './tracking/ImportHistoryTable';
import ImportDetailsModal from './tracking/ImportDetailsModal';
import StatusListTab from './tracking-status/StatusListTab';

// ============ Dashboard Stats Section ============
function StatCard({label, value, tone}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" tone="subdued">{label}</Text>
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" fontWeight="bold">{value ?? '—'}</Text>
          {tone && <Badge tone={tone}>{label}</Badge>}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

const STAT_CARDS = [
  {key: 'total', label: 'Total', tone: undefined},
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

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStore, setImportStore] = useState('');

  // Import history
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
  const [historyLimit, setHistoryLimit] = useState('100');

  // Feedback
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch tracking history (statuses from Firestore)
  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams({limit: historyLimit});
    if (historyStatusFilter) params.set('status', historyStatusFilter);

    if (historyFilterType === 'all') {
      params.set('all', 'true');
    } else if (historyFilterType === 'store' && historyStore) {
      params.set('storeId', historyStore);
    } else if (historyFilterType === 'group' && historyGroup) {
      const group = groups.find(g => g.id === historyGroup);
      const ids = stores.filter(s => s.groupId === historyGroup || s.group === group?.name).map(s => s.id);
      if (!ids.length) { setHistoryStatuses([]); return; }
      params.set('storeIds', ids.join(','));
    } else {
      return;
    }

    try {
      setHistoryLoading(true);
      const res = await api(`/api/tracking-status/statuses?${params}`);
      const data = await res.json();
      if (data.success) setHistoryStatuses(data.data);
    } catch { /* silent */ } finally {
      setHistoryLoading(false);
    }
  }, [historyFilterType, historyStore, historyGroup, historyStatusFilter, historyLimit, stores, groups]);

  useEffect(() => {
    if (historyFilterType === 'all' || (historyFilterType === 'store' && historyStore) || (historyFilterType === 'group' && historyGroup)) {
      fetchHistory();
    }
  }, [fetchHistory, historyFilterType, historyStore, historyGroup]);

  // Auto-select first store for import
  useEffect(() => {
    if (stores.length > 0 && !importStore) setImportStore(stores[0].id);
  }, [stores]);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api('/api/tracking-status/stats');
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* silent */ } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Recheck existing trackings
  const handleRecheck = async () => {
    try {
      setTriggering(true);
      setError(null);
      const res = await api('/api/tracking-status/trigger', {method: 'POST'});
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Recheck complete: ${data.data.registered} registered, ${data.data.queried} queried, ${data.data.updated} updated`);
        fetchStats();
        fetchHistory();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to trigger recheck');
    } finally {
      setTriggering(false);
    }
  };

  // Fetch import history
  const fetchImportHistory = useCallback(async () => {
    try {
      const url = importStore
        ? `/api/tracking/import-history?storeId=${importStore}`
        : '/api/tracking/import-history';
      const res = await api(url);
      const data = await res.json();
      if (data.success) setImportHistory(data.data);
    } catch { /* silent */ }
  }, [importStore]);

  useEffect(() => { fetchImportHistory(); }, [fetchImportHistory]);

  // Auto-refresh while jobs are processing
  useEffect(() => {
    const hasProcessing = importHistory.some(
      i => i.status === 'processing' || i.status === 'pending'
    );
    if (!hasProcessing) return;
    const id = setInterval(() => { fetchImportHistory(); }, 3000);
    return () => clearInterval(id);
  }, [importHistory, fetchImportHistory]);

  // Polling after import
  const pollRef = useRef(null);
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    let count = 0;
    pollRef.current = setInterval(() => {
      fetchImportHistory();
      count++;
      if (count >= 10) clearInterval(pollRef.current);
    }, 3000);
  }, [fetchImportHistory]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleDropZoneDrop = useCallback((_drop, accepted) => {
    setFile(accepted[0]); setError(null);
  }, []);

  const handleUpload = async () => {
    if (!importStore) { setError('Please select a store first'); return; }
    if (!file) { setError('Please upload an Excel file first'); return; }
    try {
      setUploading(true); setError(null); setSuccessMessage(null);
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
          setSuccessMessage(data.message); setFile(null);
          setImportModalOpen(false); startPolling();
        } else setError(data.error || 'Failed to upload file');
        setUploading(false);
      };
      reader.onerror = () => { setError('Failed to read file'); setUploading(false); };
      reader.readAsDataURL(file);
    } catch { setError('Failed to upload file'); setUploading(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api('/api/tracking/template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'tracking-import-template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { setError('Failed to download template'); }
  };

  // Options
  const importStoreOptions = [
    {label: 'Select store', value: ''},
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const statusStats = stats?.statuses || {};

  return (
    <Page
      title="Tracking Dashboard"
      subtitle="Overview, import tracking, and manage tracking records"
      primaryAction={{
        content: 'Import Tracking',
        icon: ImportIcon,
        onAction: () => { setImportModalOpen(true); setError(null); setSuccessMessage(null); }
      }}
      secondaryActions={[
        {
          content: 'Import History',
          icon: ClockIcon,
          onAction: () => { setHistoryModalOpen(true); fetchImportHistory(); }
        }
      ]}
    >
      <Layout>
        {error && !importModalOpen && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Banner>
          </Layout.Section>
        )}

        {/* Stats Overview */}
        <Layout.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" fontWeight="semibold">Status Overview</Text>
              <InlineStack gap="300">
                <Button onClick={fetchStats} disabled={statsLoading} size="slim">Refresh Stats</Button>
                <Button variant="primary" onClick={handleRecheck} loading={triggering} size="slim">
                  Recheck All
                </Button>
              </InlineStack>
            </InlineStack>
            {statsLoading && !stats ? (
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
            <Text variant="headingMd" fontWeight="semibold">Tracking History</Text>
            <StatusListTab
              statuses={historyStatuses}
              loading={historyLoading}
              statusFilter={historyStatusFilter}
              onFilterChange={setHistoryStatusFilter}
              statusLimit={historyLimit}
              onLimitChange={setHistoryLimit}
              onRefresh={fetchHistory}
              onRecheck={handleRecheck}
              recheckLoading={triggering}
              stores={stores}
              groups={groups}
              filterType={historyFilterType}
              onFilterTypeChange={setHistoryFilterType}
              selectedStore={historyStore}
              onStoreChange={setHistoryStore}
              selectedGroup={historyGroup}
              onGroupChange={setHistoryGroup}
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
              <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
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
            onViewDetails={imp => { setSelectedImport(imp); setShowDetailsModal(true); setHistoryModalOpen(false); }}
            onRefresh={fetchImportHistory}
          />
        </Modal.Section>
      </Modal>

      <ImportDetailsModal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setHistoryModalOpen(true); }}
        selectedImport={selectedImport}
      />
    </Page>
  );
}
