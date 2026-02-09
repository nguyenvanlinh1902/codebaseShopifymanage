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
  List,
  Collapsible,
  Spinner
} from '@shopify/polaris';
import {api} from '../helpers/api';

/**
 * Embedded Orders Page - Single store (from session token)
 * Features: Setup sync config, manual sync, webhook management
 */
export default function EmbedOrders() {
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settingUpSync, setSettingUpSync] = useState(false);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [syncJob, setSyncJob] = useState(null);
  const [showFields, setShowFields] = useState(false);
  const pollIntervalRef = useRef(null);

  const fetchQueueStats = useCallback(async () => {
    try {
      const response = await api('/api/embed/orders/queue-stats');
      const result = await response.json();
      if (result.success) {
        setSyncJob(result.data.activeJob);
        if (result.data.activeJob?.status === 'processing') {
          if (!pollIntervalRef.current) startPolling();
          setSyncing(true);
        } else if (!result.data.activeJob || result.data.activeJob.status === 'completed') {
          stopPolling();
          if (result.data.activeJob?.status === 'completed' && syncing) {
            const job = result.data.activeJob;
            const failedMsg = job.failedCount > 0 ? ` (${job.failedCount} failed)` : '';
            setSuccessMessage(
              `Sync completed! ${job.successCount || 0} orders synced${failedMsg}.`
            );
            fetchSyncConfigs();
          }
          setSyncing(false);
        }
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  }, [syncing]);

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
    if (selectedSheet) fetchSheetTabs();
    else {
      setSheetTabs([]);
      setSelectedTab('');
    }
  }, [selectedSheet]);

  useEffect(() => {
    if (selectedSheet) return;
    const active = syncConfigs.find(c => c.status === 'active');
    if (active) setSelectedSheet(active.sheetId);
    else if (sheets.length === 1) setSelectedSheet(sheets[0].id);
  }, [syncConfigs, sheets]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sheetsRes, configsRes] = await Promise.all([
        api('/api/embed/sheets'),
        api('/api/embed/orders/sync-configs')
      ]);
      const [sheetsData, configsData] = await Promise.all([
        sheetsRes.json(),
        configsRes.json()
      ]);
      if (sheetsData.success) setSheets(sheetsData.data);
      if (configsData.success) setSyncConfigs(configsData.data);
      fetchQueueStats();
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncConfigs = async () => {
    try {
      const response = await api('/api/embed/orders/sync-configs');
      const result = await response.json();
      if (result.success) setSyncConfigs(result.data);
    } catch (err) {
      console.error('Error fetching sync configs:', err);
    }
  };

  const fetchSheetTabs = async () => {
    try {
      setLoadingTabs(true);
      setSelectedTab('');
      const response = await api(`/api/embed/sheets/${selectedSheet}/tabs`);
      const result = await response.json();
      if (result.success) {
        setSheetTabs(result.data);
        if (result.data.length > 0) {
          const active = syncConfigs.find(c => c.status === 'active');
          let matched = null;
          if (active && active.sheetId === selectedSheet) {
            matched = result.data.find(
              t => t.sheetId === active.targetSheetId || t.title === active.targetSheet
            );
          }
          const tab = matched || result.data[0];
          setSelectedTab(`${tab.title}|${tab.sheetId}`);
        }
      }
    } catch (err) {
      console.error('Error fetching sheet tabs:', err);
    } finally {
      setLoadingTabs(false);
    }
  };

  const handleSetupSync = async () => {
    if (!selectedSheet || !selectedTab) {
      setError('Please select a sheet and tab');
      return;
    }

    try {
      setSettingUpSync(true);
      setError(null);
      setSuccessMessage(null);

      const [tabName, tabId] = selectedTab.split('|');

      const response = await api('/api/embed/orders/setup-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          sheetId: selectedSheet,
          sheetName: tabName,
          targetSheetId: parseInt(tabId, 10)
        })
      });

      const result = await response.json();
      if (result.success) {
        setSuccessMessage('Order sync configured successfully!');
        fetchSyncConfigs();
      } else {
        setError(result.error || 'Failed to setup sync');
      }
    } catch (err) {
      setError('Failed to setup sync');
    } finally {
      setSettingUpSync(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await api('/api/embed/orders/manual-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
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
      setError('Failed to sync orders');
      setSyncing(false);
    }
  };

  const sheetOptions = sheets.map(sheet => ({label: sheet.name, value: sheet.id}));
  const activeConfig = syncConfigs.find(config => config.status === 'active');

  const configRows = syncConfigs.map(config => [
    config.sheetName || 'N/A',
    config.targetSheet || 'N/A',
    <Badge key={`status-${config.id}`} tone={config.status === 'active' ? 'success' : 'info'}>
      {config.status}
    </Badge>,
    config.totalOrdersSynced || 0,
    config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never'
  ]);

  return (
    <Page
      title="Orders Sync"
      subtitle="Export orders from Shopify to Google Sheets"
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
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
                <Text variant="headingMd" as="h2">Syncing orders...</Text>
              </div>
              <div style={{marginTop: '12px'}}>
                <Text variant="headingLg" as="p">{syncJob.successCount || 0}</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  orders synced{syncJob.currentPage ? ` (page ${syncJob.currentPage})` : ''}
                </Text>
              </div>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              {activeConfig ? 'Sync Config' : 'Setup Sync'}
            </Text>

            {activeConfig && (
              <div style={{marginTop: '12px'}}>
                <Banner tone="info">
                  <p>
                    Sheet: <strong>{activeConfig.sheetName}</strong> — Tab:{' '}
                    <strong>{activeConfig.targetSheet}</strong>
                  </p>
                  <p>
                    Orders synced: {activeConfig.totalOrdersSynced || 0} | Last sync:{' '}
                    {activeConfig.lastSyncAt
                      ? new Date(activeConfig.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </p>
                </Banner>
              </div>
            )}

            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : (
              <div style={{marginTop: '16px'}}>
                <div style={{marginBottom: '16px'}}>
                  <Select
                    label="Select Google Sheet"
                    options={sheetOptions}
                    value={selectedSheet}
                    onChange={setSelectedSheet}
                    placeholder="Choose a sheet"
                  />
                </div>

                <div style={{marginBottom: '16px'}}>
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
                </div>

                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                  <Button
                    primary
                    onClick={handleSetupSync}
                    loading={settingUpSync}
                    disabled={!selectedSheet || !selectedTab}
                  >
                    {activeConfig ? 'Update Config' : 'Setup Sync'}
                  </Button>

                  {activeConfig && (
                    <Button
                      onClick={handleManualSync}
                      loading={syncing}
                      disabled={syncJob?.status === 'processing'}
                    >
                      {syncJob?.status === 'processing' ? 'Sync In Progress...' : 'Manual Sync Now'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">Export Format</Text>
            <div style={{marginTop: '16px'}}>
              <Button plain onClick={() => setShowFields(!showFields)}>
                {showFields ? 'Hide' : 'Show'} included fields
              </Button>
              <Collapsible open={showFields}>
                <div style={{marginTop: '8px'}}>
                  <Text variant="bodySm" as="p" fontWeight="semibold">Order Information:</Text>
                  <List type="bullet">
                    <List.Item>Order Number, ID, Date</List.Item>
                    <List.Item>Status, Fulfillment Status</List.Item>
                    <List.Item>Total Price, Currency</List.Item>
                  </List>
                  <div style={{marginTop: '8px'}}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">Customer Information:</Text>
                    <List type="bullet">
                      <List.Item>Customer ID, Email, Phone</List.Item>
                      <List.Item>First Name, Last Name</List.Item>
                    </List>
                  </div>
                  <div style={{marginTop: '8px'}}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">Items & Tracking:</Text>
                    <List type="bullet">
                      <List.Item>Line Items</List.Item>
                      <List.Item>Tracking Numbers & URLs</List.Item>
                    </List>
                  </div>
                </div>
              </Collapsible>
            </div>
          </Card>
        </Layout.Section>

        {syncConfigs.length > 0 && (
          <Layout.Section>
            <Card>
              <div style={{padding: '16px'}}>
                <Text variant="headingMd" as="h2">Sync History</Text>
              </div>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
                headings={['Sheet', 'Target Tab', 'Status', 'Orders Synced', 'Last Sync']}
                rows={configRows}
              />
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
