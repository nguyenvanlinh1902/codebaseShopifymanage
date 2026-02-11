import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  Spinner,
  Modal,
  InlineStack,
  BlockStack
} from '@shopify/polaris';
import {api} from '../helpers/api';

/**
 * Orders Sync Page - Export orders from Shopify to Google Sheets with customer info
 */
export default function Orders() {
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settingUpSync, setSettingUpSync] = useState(false);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [webhookStatuses, setWebhookStatuses] = useState([]);
  const [filterStore, setFilterStore] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [syncJob, setSyncJob] = useState(null);
  const pollIntervalRef = useRef(null);

  const fetchQueueStats = useCallback(async () => {
    if (!selectedStore) return;
    try {
      const response = await api(`/api/orders/queue-stats?storeId=${selectedStore}`);
      const result = await response.json();
      if (result.success) {
        setSyncJob(result.data.activeJob);
        if (result.data.activeJob?.status === 'processing') {
          if (!pollIntervalRef.current) {
            startPolling();
          }
          setSyncing(true);
        } else if (!result.data.activeJob || result.data.activeJob.status === 'completed') {
          stopPolling();
          if (result.data.activeJob?.status === 'completed' && syncing) {
            const job = result.data.activeJob;
            const failedMsg = job.failedCount > 0 ? ` (${job.failedCount} failed)` : '';
            setSuccessMessage(
              `Sync completed! ${job.successCount ||
                0} orders synced to Google Sheets successfully${failedMsg}.`
            );
            fetchAllSyncConfigs();
          }
          setSyncing(false);
        }
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  }, [selectedStore, syncing]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(fetchQueueStats, 5000);
  }, [fetchQueueStats]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      ensureWebhooksRegistered();
      fetchQueueStats();
    } else {
      setSyncJob(null);
      stopPolling();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedSheet) {
      fetchSheetTabs();
    } else {
      setSheetTabs([]);
      setSelectedTab('');
    }
  }, [selectedSheet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes] = await Promise.all([api('/api/stores'), api('/api/sheets')]);
      const [storesData, sheetsData] = await Promise.all([storesRes.json(), sheetsRes.json()]);

      if (storesData.success) {
        setStores(storesData.data);
        if (storesData.data.length > 0) fetchWebhookStatuses(storesData.data);
      }
      if (sheetsData.success) setSheets(sheetsData.data);

      await fetchAllSyncConfigs();
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSyncConfigs = async () => {
    try {
      const response = await api('/api/orders/sync-configs');
      const result = await response.json();
      if (result.success) {
        setSyncConfigs(result.data);
      }
    } catch (err) {
      console.error('Error fetching sync configs:', err);
    }
  };

  const fetchWebhookStatuses = async storeList => {
    try {
      const results = await Promise.all(
        storeList.map(async store => {
          const res = await api(`/api/orders/webhook-instructions?storeId=${store.id}`);
          const data = await res.json();
          return {
            storeId: store.id,
            storeName: store.name,
            webhooks: data.success ? data.data.registeredWebhooks || [] : []
          };
        })
      );
      setWebhookStatuses(results);
    } catch (err) {
      console.error('Error fetching webhook statuses:', err);
    }
  };

  const ensureWebhooksRegistered = async () => {
    try {
      const response = await api(`/api/orders/webhook-instructions?storeId=${selectedStore}`);
      const result = await response.json();

      if (result.success && result.data) {
        const hasRegistered = result.data.registeredWebhooks?.length > 0;
        if (!hasRegistered) {
          const regRes = await api('/api/orders/register-webhook', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              storeId: selectedStore,
              webhookUrl: result.data.webhookUrl
            })
          });
          const regResult = await regRes.json();
          if (regResult.success) {
            console.log('Webhook auto-registered for store:', selectedStore);
            fetchWebhookStatuses(stores);
          } else {
            console.warn('Webhook auto-register failed:', regResult.error);
          }
        }
      }
    } catch (err) {
      console.error('Error ensuring webhooks:', err);
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
        setSuccessMessage('Order sync configured successfully!');
        setShowSetupModal(false);
        fetchAllSyncConfigs();
        ensureWebhooksRegistered();
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

  const handleManualSync = async storeId => {
    if (!storeId) return;

    try {
      setSyncing(true);
      setSelectedStore(storeId);
      setError(null);
      setSuccessMessage(null);

      const response = await api('/api/orders/manual-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeId})
      });

      const result = await response.json();

      if (result.success) {
        const {jobId, newOrders, alreadySynced, hasNextPage, currentPage} = result.data || {};
        if (newOrders === 0 && !hasNextPage) {
          setSuccessMessage(result.message || 'No new orders to sync.');
          setSyncing(false);
        } else {
          const pageMsg = hasNextPage ? ' (more pages will be fetched automatically)' : '';
          setSuccessMessage(
            `Page ${currentPage}: ${newOrders} new orders queued (${alreadySynced} already synced)${pageMsg}`
          );
          setSyncJob({id: jobId, status: 'processing', successCount: 0, hasNextPage, currentPage});
          await fetchQueueStats();
          startPolling();
        }
      } else {
        setError(result.error || 'Failed to sync orders');
        setSyncing(false);
      }
    } catch (err) {
      console.error('Error syncing orders:', err);
      setError('Failed to sync orders');
      setSyncing(false);
    }
  };

  const storeOptions = stores.map(store => ({label: store.name, value: store.id}));
  const sheetOptions = sheets.map(sheet => ({label: sheet.name, value: sheet.id}));

  const filterStoreOptions = [{label: 'All Stores', value: ''}, ...storeOptions];

  // Build webhook lookup
  const webhookMap = {};
  webhookStatuses.forEach(ws => {
    webhookMap[ws.storeId] = ws.webhooks;
  });

  // Filter configs by store
  const filteredConfigs = filterStore
    ? syncConfigs.filter(c => c.storeId === filterStore)
    : syncConfigs;

  const configRows = filteredConfigs.map(config => {
    const storeWebhooks = webhookMap[config.storeId] || [];
    return [
      config.storeName || 'N/A',
      config.sheetName || 'N/A',
      config.targetSheet || 'N/A',
      <Badge key={`s-${config.id}`} tone={config.status === 'active' ? 'success' : 'info'}>
        {config.status}
      </Badge>,
      storeWebhooks.length > 0 ? (
        <Badge key={`w-${config.id}`} tone="success">
          {storeWebhooks.length} registered
        </Badge>
      ) : (
        <Badge key={`w-${config.id}`} tone="warning">
          None
        </Badge>
      ),
      config.totalOrdersSynced || 0,
      config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never',
      <Button
        key={`sync-${config.id}`}
        size="slim"
        onClick={() => handleManualSync(config.storeId)}
        loading={syncing && selectedStore === config.storeId}
        disabled={syncing}
      >
        Sync
      </Button>
    ];
  });

  return (
    <Page
      title="Orders Sync"
      subtitle="Export orders from Shopify to Google Sheets with customer info"
      primaryAction={{
        content: 'Setup Sync',
        onAction: () => setShowSetupModal(true)
      }}
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

        {syncJob && syncJob.status === 'processing' && (
          <Layout.Section>
            <Card sectioned>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Spinner size="small" />
                <Text variant="headingMd" as="h2">
                  Syncing orders...
                </Text>
              </div>
              <div style={{marginTop: '12px'}}>
                <InlineStack gap="400" blockAlign="center">
                  <Text variant="headingLg" as="p">
                    {syncJob.successCount || 0}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    orders synced
                    {syncJob.currentPage ? ` (page ${syncJob.currentPage})` : ''}
                  </Text>
                </InlineStack>
                {syncJob.queueStats &&
                  (syncJob.queueStats.pending > 0 || syncJob.queueStats.processing > 0) && (
                    <InlineStack gap="300" blockAlign="center">
                      {syncJob.queueStats.pending > 0 && (
                        <Badge tone="attention">Pending: {syncJob.queueStats.pending}</Badge>
                      )}
                      {syncJob.queueStats.processing > 0 && (
                        <Badge tone="warning">Processing: {syncJob.queueStats.processing}</Badge>
                      )}
                      {syncJob.queueStats.failed > 0 && (
                        <Badge tone="critical">Failed: {syncJob.queueStats.failed}</Badge>
                      )}
                    </InlineStack>
                  )}
                <InlineStack gap="200" blockAlign="center">
                  <Button size="slim" variant="plain" onClick={fetchQueueStats}>
                    Refresh
                  </Button>
                  <Text variant="bodySm" as="span" tone="subdued">
                    Auto-refreshes every 5s
                  </Text>
                </InlineStack>
              </div>
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
                <div style={{minWidth: '250px'}}>
                  <Select
                    label="Filter by store"
                    labelHidden
                    options={filterStoreOptions}
                    value={filterStore}
                    onChange={setFilterStore}
                  />
                </div>
              </InlineStack>

              {loading ? (
                <SkeletonBodyText lines={5} />
              ) : filteredConfigs.length === 0 ? (
                <Banner tone="info">
                  {syncConfigs.length === 0
                    ? 'No sync configurations yet. Click "Setup Sync" to get started.'
                    : 'No configurations match the selected store filter.'}
                </Banner>
              ) : (
                <DataTable
                  columnContentTypes={[
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                    'numeric',
                    'text',
                    'text'
                  ]}
                  headings={[
                    'Store',
                    'Google Sheet',
                    'Tab',
                    'Status',
                    'Webhook',
                    'Orders Synced',
                    'Last Sync',
                    ''
                  ]}
                  rows={configRows}
                />
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
    </Page>
  );
}
