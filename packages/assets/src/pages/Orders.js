import React, {useState, useEffect, useRef} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  Modal,
  InlineStack,
  BlockStack,
  Checkbox,
  Spinner,
  DatePicker
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import PaginationControls from '../components/pagination-controls';
import StoreSelector from '../components/store-selector';

/**
 * Orders Sync Page - Setup which Google Sheet to sync orders to.
 * Webhooks are auto-registered on app install.
 */
export default function Orders() {
  const {stores} = usePermittedStores();
  const [sheets, setSheets] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingUpSync, setSettingUpSync] = useState(false);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [filterStore, setFilterStore] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pagination, setPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(false);

  // Sync Missing modal — 3 steps: select → check (dryRun) → confirm → sync
  const [showSyncMissingModal, setShowSyncMissingModal] = useState(false);
  const [syncDays, setSyncDays] = useState('7');
  const [selectedStoreIds, setSelectedStoreIds] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('select'); // select | check | done
  const [checkResults, setCheckResults] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [allActiveConfigs, setAllActiveConfigs] = useState([]);

  useEffect(() => {
    if (selectedSheet) {
      fetchSheetTabs();
    } else {
      setSheetTabs([]);
      setSelectedTab('');
    }
  }, [selectedSheet]);

  // Single effect: fetch on any pagination/filter change, auto-reset page when filters change
  const filtersRef = useRef({perPage, search, filterStore, filterStatus});
  useEffect(() => {
    const prev = filtersRef.current;
    const filtersChanged =
      prev.perPage !== perPage ||
      prev.search !== search ||
      prev.filterStore !== filterStore ||
      prev.filterStatus !== filterStatus;
    filtersRef.current = {perPage, search, filterStore, filterStatus};

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }
    fetchAllSyncConfigs();
  }, [page, perPage, search, filterStore, filterStatus]);

  const fetchAllSyncConfigs = async () => {
    try {
      setFetching(true);
      const params = new URLSearchParams({page, perPage, search});
      if (filterStore) params.set('storeId', filterStore);
      if (filterStatus) params.set('status', filterStatus);
      const response = await api(`/api/orders/sync-configs?${params}`);
      const result = await response.json();
      if (result.success) {
        setSyncConfigs(result.data);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch (err) {
      console.error('Error fetching sync configs:', err);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  // Lazy load sheets only when setup modal opens
  const fetchSheets = async () => {
    if (sheets.length > 0) return;
    try {
      const res = await api('/api/sheets');
      const data = await res.json();
      if (data.success) setSheets(data.data);
    } catch (err) {
      console.error('Error fetching sheets:', err);
    }
  };

  const fetchSheetTabs = async () => {
    try {
      setLoadingTabs(true);
      setSelectedTab('');
      const response = await api(`/api/sheets/${selectedSheet}/tabs`);
      const result = await response.json();

      if (result.success) {
        setSheetTabs(result.data);
        if (result.data.length > 0) {
          setSelectedTab(`${result.data[0].title}|${result.data[0].sheetId}`);
        }
      }
    } catch (err) {
      console.error('Error fetching sheet tabs:', err);
    } finally {
      setLoadingTabs(false);
    }
  };

  const handleSetupSync = async () => {
    if (!selectedStore || !selectedSheet || !selectedTab) {
      setError('Please select a store, sheet and tab');
      return;
    }

    try {
      setSettingUpSync(true);
      setError(null);
      setSuccessMessage(null);

      const [tabName, tabId] = selectedTab.split('|');

      const response = await api('/api/orders/setup-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storeId: selectedStore,
          sheetId: selectedSheet,
          sheetName: tabName,
          targetSheetId: parseInt(tabId, 10)
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          'Order sync configured successfully! New orders will auto-sync to this sheet.'
        );
        setShowSetupModal(false);
        fetchAllSyncConfigs();
      } else {
        setError(result.error || 'Failed to setup sync');
      }
    } catch (err) {
      console.error('Error setting up sync:', err);
      setError('Failed to setup sync');
    } finally {
      setSettingUpSync(false);
    }
  };

  // Stores already having an active sync config are excluded from the setup dropdown
  const usedStoreIds = new Set(
    syncConfigs.filter(c => c.status === 'active').map(c => c.storeId)
  );
  const storeOptions = stores
    .filter(store => !usedStoreIds.has(store.id))
    .map(store => ({label: store.name, value: store.id}));

  // Sheets already assigned to an active sync config should not appear in the setup dropdown
  const usedSheetIds = new Set(
    syncConfigs.filter(c => c.status === 'active' && c.sheetId).map(c => c.sheetId)
  );
  const sheetOptions = sheets
    .filter(sheet => !usedSheetIds.has(sheet.id))
    .map(sheet => ({label: sheet.name, value: sheet.id}));

  const allStoreOptions = stores.map(store => ({label: store.name, value: store.id}));
  const filterStoreOptions = [{label: 'All Stores', value: ''}, ...allStoreOptions];

  const filterStatusOptions = [
    {label: 'All Status', value: ''},
    {label: 'Active', value: 'active'},
    {label: 'Inactive', value: 'inactive'}
  ];

  // Date range picker — default to last 7 days
  const defaultEnd = new Date();
  const defaultStart = new Date(Date.now() - 7 * 86400000);
  const [dateRange, setDateRange] = useState({start: defaultStart, end: defaultEnd});
  const [datePickerMonth, setDatePickerMonth] = useState({month: defaultStart.getMonth(), year: defaultStart.getFullYear()});

  const fmtDate = d => d.toLocaleDateString('en-CA');
  const getDateLabel = () => `${fmtDate(dateRange.start)} → ${fmtDate(dateRange.end)}`;
  const getSyncDaysValue = () => Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1);

  const toggleStoreId = (storeId) => {
    setSelectedStoreIds(prev => ({...prev, [storeId]: !prev[storeId]}));
  };

  const toggleAllStores = () => {
    const allSelected = allActiveConfigs.every(c => selectedStoreIds[c.storeId]);
    if (allSelected) {
      setSelectedStoreIds({});
    } else {
      const all = {};
      allActiveConfigs.forEach(c => { all[c.storeId] = true; });
      setSelectedStoreIds(all);
    }
  };

  const syncPollRef = useRef(null);
  const currentJobIdRef = useRef(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const startPolling = (jobId, isDryRun) => {
    if (syncPollRef.current) clearInterval(syncPollRef.current);
    currentJobIdRef.current = jobId;
    setSyncing(true);
    setSyncStep(isDryRun ? 'checking' : 'syncing');
    syncPollRef.current = setInterval(async () => {
      try {
        const pollRes = await api(`/api/orders/sync-missing/${jobId}`);
        const pollResult = await pollRes.json();
        if (!pollResult.success) return;
        const job = pollResult.data;
        setSyncProgress({
          processedStores: job.processedStores || 0,
          totalStores: job.totalStores || 0,
          results: job.results || []
        });
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(syncPollRef.current);
          syncPollRef.current = null;
          currentJobIdRef.current = null;
          setSyncing(false);
          setSyncProgress(null);
          if (job.status === 'failed') {
            setError(job.error || 'Sync job failed');
            return;
          }
          if (job.status === 'cancelled') {
            setSyncStep('select');
            return;
          }
          if (job.dryRun) {
            setCheckResults(job.results || []);
            setSyncStep('check');
          } else {
            setSyncResults(job.results || []);
            setSyncStep('done');
            fetchAllSyncConfigs();
          }
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const handleStopSync = async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;
    try {
      await api(`/api/orders/sync-missing/${jobId}/cancel`, {method: 'POST'});
      clearInterval(syncPollRef.current);
      syncPollRef.current = null;
      currentJobIdRef.current = null;
      setSyncing(false);
      setSyncProgress(null);
      setSyncStep('select');
    } catch (err) {
      setError('Failed to stop: ' + err.message);
    }
  };

  // Resume polling if there's an active job (page load / tab switch)
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/orders/sync-missing/active');
        const result = await res.json();
        if (result.success && result.data) {
          const job = result.data;
          setSyncProgress({
            processedStores: job.processedStores || 0,
            totalStores: job.totalStores || 0,
            results: job.results || []
          });
          startPolling(job.id, job.dryRun);
        }
      } catch { /* no active job */ }
    })();
  }, []);

  const callSyncMissing = async (dryRun, overrideIds = null) => {
    const ids = overrideIds || Object.keys(selectedStoreIds).filter(id => selectedStoreIds[id]);
    if (ids.length === 0) return;
    setSyncProgress({processedStores: 0, totalStores: ids.length, results: []});
    setShowSyncMissingModal(false);
    try {
      const res = await api('/api/orders/sync-missing', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeIds: ids, createdAtMin: fmtDate(dateRange.start), createdAtMax: fmtDate(dateRange.end), dryRun})
      });
      const result = await res.json();
      if (!result.success) { setError(result.error || 'Sync failed'); setSyncProgress(null); return; }
      startPolling(result.data.jobId, dryRun);
    } catch (err) {
      setError('Sync failed: ' + err.message);
      setSyncProgress(null);
    }
  };

  // Cleanup poll on unmount
  useEffect(() => () => { if (syncPollRef.current) clearInterval(syncPollRef.current); }, []);

  const openSyncMissingModal = async () => {
    setSyncResults(null);
    setCheckResults(null);
    setSyncStep('select');
    setSelectedStoreIds({});
    setShowSyncMissingModal(true);
    // Fetch ALL active configs (unpaginated) for store list
    try {
      const res = await api('/api/orders/sync-configs?status=active&perPage=500');
      const result = await res.json();
      if (result.success) {
        // Filter: only show stores that exist in the stores list (exclude orphaned configs)
        const storeIdSet = new Set(stores.map(s => s.id));
        setAllActiveConfigs(result.data.filter(c => storeIdSet.has(c.storeId)));
      }
    } catch (err) {
      console.error('Error fetching active configs:', err);
    }
  };

  const totalMissing = (checkResults || []).reduce((sum, r) => sum + r.missing, 0);

  const configRows = syncConfigs.map(config => [
    config.storeName || 'N/A',
    config.shopDomain || 'N/A',
    config.spreadsheetId ? (
      <a
        key={`sheet-${config.id}`}
        href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
        target="_blank"
        rel="noopener noreferrer"
        style={{textDecoration: 'none', color: '#2c6ecb'}}
      >
        {config.sheetName || 'N/A'}
      </a>
    ) : (
      config.sheetName || 'N/A'
    ),
    config.targetSheet || 'N/A',
    <Badge key={`s-${config.id}`} tone={config.status === 'active' ? 'success' : 'info'}>
      {config.status}
    </Badge>,
    config.totalOrdersSynced || 0,
    config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never'
  ]);

  return (
    <Page
      title="Orders Sync"
      subtitle="Export orders from Shopify to Google Sheets with customer info"
      primaryAction={{
        content: 'Setup Sync',
        onAction: () => { fetchSheets(); setShowSetupModal(true); },
        loading: loading,
        disabled: loading
      }}
      secondaryActions={[{
          content: 'Sync Missing Orders',
          onAction: openSyncMissingModal,
          disabled: loading
        }
      ]}
    >
      <Layout>
        {error && (
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

        {/* Sync Missing Progress Card (like Product import) */}
        {syncProgress && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    {syncStep === 'checking' ? 'Checking Missing Orders...' : 'Syncing Missing Orders...'}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="attention">
                      {syncProgress.processedStores}/{syncProgress.totalStores} stores
                    </Badge>
                    <button
                      onClick={handleStopSync}
                      style={{
                        background: '#e4e5e7',
                        color: '#303030',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Stop
                    </button>
                  </InlineStack>
                </InlineStack>
                <div style={{width: '100%', height: '8px', backgroundColor: '#e4e5e7', borderRadius: '4px', overflow: 'hidden'}}>
                  <div style={{
                      width: `${
                        syncProgress.totalStores > 0
                          ? Math.round(
                              (syncProgress.processedStores / syncProgress.totalStores) * 100
                            )
                          : 0
                      }%`,
                      height: '100%',
                      backgroundColor: '#008060',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <InlineStack gap="400">
                  <Text variant="bodySm" tone="subdued">
                    {syncProgress.processedStores} of {syncProgress.totalStores} stores processed
                  </Text>
                  {syncProgress.results.length > 0 && (
                    <>
                      {syncStep === 'syncing' && (
                        <Text variant="bodySm" tone="success">
                          {syncProgress.results.reduce((s, r) => s + (r.synced || 0), 0)} synced
                        </Text>
                      )}
                      <Text variant="bodySm" tone="subdued">
                        {syncProgress.results.reduce((s, r) => s + (r.missing || 0), 0)} missing found
                      </Text>
                    </>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Check/Done results inline */}
        {!syncProgress && syncStep === 'check' && checkResults && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Missing Orders Found</Text>
                  <InlineStack gap="200">
                    <Badge tone={totalMissing > 0 ? 'warning' : 'success'}>
                      {totalMissing} missing
                    </Badge>
                    {totalMissing > 0 && (
                      <button
                        onClick={() => callSyncMissing(false, checkResults.filter(r => r.missing > 0 && !r.error).map(r => r.storeId).filter(Boolean))}
                        style={{
                          background: '#d82c0d', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                        }}
                      >
                        Sync {totalMissing} Missing Orders
                      </button>
                    )}
                    <button
                      onClick={() => { setCheckResults(null); setSyncStep('select'); }}
                      style={{
                        background: '#e4e5e7', color: '#303030', border: 'none', borderRadius: '6px',
                        padding: '6px 16px', cursor: 'pointer', fontSize: '13px'
                      }}
                    >
                      Dismiss
                    </button>
                  </InlineStack>
                </InlineStack>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text']}
                  headings={['Store', 'Fetched', 'In Sheet', 'Missing', 'Status']}
                  rows={checkResults.map(r => [
                    r.storeName || r.storeId,
                    r.totalFetched,
                    r.alreadyInSheet,
                    r.missing,
                    r.error || (r.missing === 0 ? 'All caught up' : `${r.missing} missing`)
                  ])}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {!syncProgress && syncStep === 'done' && syncResults && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Sync Completed</Text>
                  <InlineStack gap="200">
                    <Badge tone="success">{syncResults.reduce((s, r) => s + r.synced, 0)} synced</Badge>
                    <button
                      onClick={() => { setSyncResults(null); setSyncStep('select'); }}
                      style={{
                        background: '#e4e5e7', color: '#303030', border: 'none', borderRadius: '6px',
                        padding: '6px 16px', cursor: 'pointer', fontSize: '13px'
                      }}
                    >
                      Dismiss
                    </button>
                  </InlineStack>
                </InlineStack>
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'text']}
                  headings={['Store', 'Fetched', 'In Sheet', 'Synced', 'Status']}
                  rows={syncResults.map(r => [
                    r.storeName || r.storeId,
                    r.totalFetched,
                    r.alreadyInSheet,
                    r.synced,
                    r.error ? r.error : r.missing === 0 ? 'All caught up' : `${r.synced} added`
                  ])}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  Sync Configurations
                </Text>
                <InlineStack gap="300">
                  <div style={{minWidth: '150px'}}>
                    <Select
                      label="Filter by status"
                      labelHidden
                      options={filterStatusOptions}
                      value={filterStatus}
                      onChange={setFilterStatus}
                    />
                  </div>
                  <div style={{minWidth: '250px'}}>
                    <StoreSelector
                      label="All Stores"
                      options={filterStoreOptions}
                      value={filterStore}
                      onChange={setFilterStore}
                    />
                  </div>
                </InlineStack>
              </InlineStack>

              {loading ? (
                <SkeletonBodyText lines={5} />
              ) : fetching ? (
                <SkeletonBodyText lines={3} />
              ) : syncConfigs.length === 0 ? (
                <Banner tone="info">
                  {syncConfigs.length === 0
                    ? 'No sync configurations yet. Click "Setup Sync" to get started.'
                    : 'No configurations match the selected store filter.'}
                </Banner>
              ) : (
                <>
                  <PaginationControls
                    page={page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    perPage={perPage}
                    onPageChange={setPage}
                    onPerPageChange={setPerPage}
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by store, sheet, or tab..."
                  />
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                    headings={[
                      'Store',
                      'Domain',
                      'Google Sheet',
                      'Tab',
                      'Status',
                      'Orders Synced',
                      'Last Sync'
                    ]}
                    rows={configRows}
                  />
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Setup Sync Modal */}
      <Modal
        open={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        title="Setup Order Sync"
        primaryAction={{
          content: 'Setup Sync',
          onAction: handleSetupSync,
          loading: settingUpSync,
          disabled: !selectedStore || !selectedSheet || !selectedTab
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setShowSetupModal(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Select Store"
              options={storeOptions}
              value={selectedStore}
              onChange={setSelectedStore}
              placeholder="Choose a store"
            />

            <Select
              label="Select Google Sheet"
              options={sheetOptions}
              value={selectedSheet}
              onChange={setSelectedSheet}
              placeholder="Choose a sheet"
            />

            <Select
              label="Sheet Tab"
              options={sheetTabs.map(tab => ({
                label: tab.title,
                value: `${tab.title}|${tab.sheetId}`
              }))}
              value={selectedTab}
              onChange={setSelectedTab}
              placeholder="Choose a tab"
              disabled={loadingTabs || sheetTabs.length === 0}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Sync Missing Orders Modal — select stores + days only */}
      <Modal
        open={showSyncMissingModal}
        onClose={() => setShowSyncMissingModal(false)}
        title="Sync Missing Orders"
        primaryAction={{
          content: 'Check Missing Orders',
          onAction: () => callSyncMissing(true),
          disabled: Object.values(selectedStoreIds).filter(Boolean).length === 0
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setShowSyncMissingModal(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Check for missing orders in Google Sheets and add them.
            </Text>
            <BlockStack gap="200">
              <Text variant="bodySm" fontWeight="semibold">Date range: {getDateLabel()}</Text>
              <DatePicker
                month={datePickerMonth.month}
                year={datePickerMonth.year}
                onChange={({start, end}) => setDateRange({start, end})}
                onMonthChange={(month, year) => setDatePickerMonth({month, year})}
                selected={{start: dateRange.start, end: dateRange.end}}
                allowRange
                multiMonth
                disableDatesAfter={new Date()}
              />
            </BlockStack>
            <BlockStack gap="200">
              <Checkbox
                label={<Text fontWeight="bold">All Stores ({allActiveConfigs.length})</Text>}
                checked={allActiveConfigs.length > 0 && allActiveConfigs.every(c => selectedStoreIds[c.storeId])}
                onChange={toggleAllStores}
              />
              {allActiveConfigs.map(config => (
                <Checkbox
                  key={config.storeId}
                  label={config.storeName}
                  checked={!!selectedStoreIds[config.storeId]}
                  onChange={() => toggleStoreId(config.storeId)}
                />
              ))}
              {allActiveConfigs.length === 0 && (
                <Banner tone="warning">No stores with active sync config found.</Banner>
              )}
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
