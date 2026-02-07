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
  Modal,
  List,
  Collapsible,
  Spinner
} from '@shopify/polaris';
import {USER_ID} from '../config/user';

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
  const [webhookInstructions, setWebhookInstructions] = useState(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showWebhookListModal, setShowWebhookListModal] = useState(false);
  const [webhookList, setWebhookList] = useState(null);
  const [loadingWebhookList, setLoadingWebhookList] = useState(false);
  const [showInstructionsOpen, setShowInstructionsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [syncJob, setSyncJob] = useState(null);
  const pollIntervalRef = useRef(null);

  const fetchQueueStats = useCallback(async () => {
    if (!selectedStore) return;
    try {
      const response = await fetch(`/api/orders/queue-stats?storeId=${selectedStore}`);
      const result = await response.json();
      if (result.success) {
        setSyncJob(result.data.activeJob);
        if (result.data.activeJob?.status === 'processing') {
          // Active job found, ensure polling is running
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
            fetchSyncConfigs();
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchSyncConfigs();
      fetchWebhookInstructions();
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

  // Pre-fill form from active config when syncConfigs load
  useEffect(() => {
    const active = syncConfigs.find(c => c.status === 'active');
    if (active && !selectedSheet) {
      setSelectedSheet(active.sheetId);
    }
  }, [syncConfigs]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes] = await Promise.all([
        fetch(`/api/stores?userId=${USER_ID}`),
        fetch(`/api/sheets?userId=${USER_ID}`)
      ]);

      const [storesData, sheetsData] = await Promise.all([storesRes.json(), sheetsRes.json()]);

      if (storesData.success) setStores(storesData.data);
      if (sheetsData.success) setSheets(sheetsData.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncConfigs = async () => {
    try {
      const response = await fetch(
        `/api/orders/sync-configs?userId=${USER_ID}&storeId=${selectedStore}`
      );
      const result = await response.json();

      if (result.success) {
        setSyncConfigs(result.data);
      }
    } catch (err) {
      console.error('Error fetching sync configs:', err);
    }
  };

  const fetchWebhookInstructions = async () => {
    try {
      const response = await fetch(`/api/orders/webhook-instructions?storeId=${selectedStore}`);
      const result = await response.json();

      if (result.success) {
        setWebhookInstructions(result.data);
      }
    } catch (err) {
      console.error('Error fetching webhook instructions:', err);
    }
  };

  const fetchSheetTabs = async () => {
    try {
      setLoadingTabs(true);
      setSelectedTab('');
      const response = await fetch(`/api/sheets/${selectedSheet}/tabs`);
      const result = await response.json();

      if (result.success) {
        setSheetTabs(result.data);
        if (result.data.length > 0) {
          // Try to match active config's tab
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
    if (!selectedStore || !selectedSheet || !selectedTab) {
      setError('Please select a store, sheet and tab');
      return;
    }

    try {
      setSettingUpSync(true);
      setError(null);
      setSuccessMessage(null);

      const [tabName, tabId] = selectedTab.split('|');

      const response = await fetch('/api/orders/setup-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          storeId: selectedStore,
          sheetId: selectedSheet,
          sheetName: tabName,
          targetSheetId: parseInt(tabId, 10)
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(
          'Order sync configured successfully! Now set up webhooks for real-time sync.'
        );
        fetchSyncConfigs();
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

  const handleManualSync = async () => {
    if (!selectedStore) {
      setError('Please select a store');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/orders/manual-sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storeId: selectedStore
        })
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

  const fetchWebhookList = async () => {
    if (!selectedStore) return;
    try {
      setLoadingWebhookList(true);
      const response = await fetch(`/api/orders/webhook-list?storeId=${selectedStore}`);
      const result = await response.json();
      if (result.success) {
        setWebhookList(result.data);
        setShowWebhookListModal(true);
      } else {
        setError(result.error || 'Failed to fetch webhook list');
      }
    } catch (err) {
      console.error('Error fetching webhook list:', err);
      setError('Failed to fetch webhook list');
    } finally {
      setLoadingWebhookList(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    if (!selectedStore || !webhookInstructions) {
      setError('Please select a store first');
      return;
    }

    try {
      const response = await fetch('/api/orders/register-webhook', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          storeId: selectedStore,
          webhookUrl: webhookInstructions.webhookUrl
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage('Webhook registered successfully! Orders will now sync automatically.');
        fetchWebhookInstructions();
        setShowWebhookModal(false);
      } else {
        setError(result.error || 'Failed to register webhook');
      }
    } catch (err) {
      console.error('Error registering webhook:', err);
      setError('Failed to register webhook');
    }
  };

  const storeOptions = stores.map(store => ({
    label: store.name,
    value: store.id
  }));

  const sheetOptions = sheets.map(sheet => ({
    label: sheet.name,
    value: sheet.id
  }));

  const activeConfig = syncConfigs.find(config => config.status === 'active');

  const configRows = syncConfigs.map(config => [
    config.storeName || 'N/A',
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
      subtitle="Export orders from Shopify to Google Sheets with customer info"
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
                <div
                  style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}
                >
                  <Text variant="headingLg" as="p">
                    {syncJob.successCount || 0}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    orders synced
                    {syncJob.currentPage ? ` (page ${syncJob.currentPage})` : ''}
                  </Text>
                </div>
                {syncJob.queueStats &&
                  (syncJob.queueStats.pending > 0 || syncJob.queueStats.processing > 0) && (
                    <div style={{marginBottom: '8px', display: 'flex', gap: '12px'}}>
                      {syncJob.queueStats.pending > 0 && (
                        <Badge tone="attention">Pending: {syncJob.queueStats.pending}</Badge>
                      )}
                      {syncJob.queueStats.processing > 0 && (
                        <Badge tone="warning">Processing: {syncJob.queueStats.processing}</Badge>
                      )}
                      {syncJob.queueStats.failed > 0 && (
                        <Badge tone="critical">Failed: {syncJob.queueStats.failed}</Badge>
                      )}
                    </div>
                  )}
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <Button size="slim" variant="plain" onClick={fetchQueueStats}>
                    Refresh
                  </Button>
                  <Text variant="bodySm" as="span" tone="subdued">
                    Auto-refreshes every 5s
                  </Text>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section oneThird>
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
                    label="Select Store"
                    options={storeOptions}
                    value={selectedStore}
                    onChange={setSelectedStore}
                    placeholder="Choose a store"
                  />
                </div>

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

                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <Button
                    primary
                    fullWidth
                    onClick={handleSetupSync}
                    loading={settingUpSync}
                    disabled={!selectedStore || !selectedSheet || !selectedTab}
                  >
                    {activeConfig ? 'Update Config' : 'Setup Sync'}
                  </Button>

                  {activeConfig && (
                    <Button
                      fullWidth
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

        <Layout.Section oneThird>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Webhook URL
            </Text>

            <div style={{marginTop: '16px'}}>
              {!selectedStore ? (
                <Text variant="bodySm" as="p" tone="subdued">
                  Select a store to view webhook URL
                </Text>
              ) : webhookInstructions ? (
                <div>
                  <div style={{marginBottom: '12px'}}>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Copy this URL and paste it in your Shopify webhook settings:
                    </Text>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      background: '#f6f6f7',
                      borderRadius: '4px',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      marginBottom: '12px'
                    }}
                  >
                    {webhookInstructions.webhookUrl}
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    <Button primary fullWidth onClick={handleRegisterWebhooks}>
                      Auto-Register Webhook
                    </Button>

                    {webhookInstructions.registeredWebhooks?.length > 0 ? (
                      <Banner tone="success">✅ Webhook registered successfully</Banner>
                    ) : (
                      <Banner tone="info">⚠️ Webhook not registered yet</Banner>
                    )}

                    <Button plain fullWidth onClick={() => setShowWebhookModal(true)}>
                      View Full Instructions
                    </Button>

                    <Button plain fullWidth onClick={fetchWebhookList} loading={loadingWebhookList}>
                      View All Webhooks
                    </Button>
                  </div>
                </div>
              ) : (
                <Text variant="bodySm" as="p" tone="subdued">
                  Loading webhook information...
                </Text>
              )}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Export Format
            </Text>

            <div style={{marginTop: '16px'}}>
              <Button plain onClick={() => setShowInstructionsOpen(!showInstructionsOpen)}>
                {showInstructionsOpen ? 'Hide' : 'Show'} included fields
              </Button>

              <Collapsible open={showInstructionsOpen}>
                <div style={{marginTop: '8px'}}>
                  <Text variant="bodySm" as="p" fontWeight="semibold">
                    Order Information:
                  </Text>
                  <List type="bullet">
                    <List.Item>Order Number, ID, Date</List.Item>
                    <List.Item>Status, Fulfillment Status</List.Item>
                    <List.Item>Total Price, Currency</List.Item>
                    <List.Item>Payment Method</List.Item>
                  </List>

                  <div style={{marginTop: '8px'}}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      Customer Information:
                    </Text>
                    <List type="bullet">
                      <List.Item>Customer ID, Email, Phone</List.Item>
                      <List.Item>First Name, Last Name</List.Item>
                    </List>
                  </div>

                  <div style={{marginTop: '8px'}}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      Addresses:
                    </Text>
                    <List type="bullet">
                      <List.Item>Shipping Address (Full)</List.Item>
                      <List.Item>Billing Address</List.Item>
                    </List>
                  </div>

                  <div style={{marginTop: '8px'}}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      Items & Tracking:
                    </Text>
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
                <Text variant="headingMd" as="h2">
                  Sync History
                </Text>
              </div>

              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text']}
                headings={['Store', 'Sheet', 'Target Tab', 'Status', 'Orders Synced', 'Last Sync']}
                rows={configRows}
              />
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Webhook Instructions Modal */}
      <Modal
        large
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        title="Webhook Setup Instructions"
        primaryAction={{
          content: 'Auto-Register Webhook',
          onAction: handleRegisterWebhooks
        }}
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setShowWebhookModal(false)
          }
        ]}
      >
        <Modal.Section>
          {webhookInstructions && (
            <div>
              <Banner tone="info">
                <p>
                  <strong>Important:</strong> All stores send webhooks to the same URL. The system
                  identifies each store by its shop domain.
                </p>
              </Banner>

              <div style={{marginTop: '16px'}}>
                <Text variant="headingMd" as="h3">
                  Webhook URL:
                </Text>
                <div
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: '#f6f6f7',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '13px'
                  }}
                >
                  {webhookInstructions.webhookUrl}
                </div>
              </div>

              <div style={{marginTop: '24px'}}>
                <Text variant="headingMd" as="h3">
                  Option 1: Auto-Register (Recommended)
                </Text>
                <Text variant="bodySm" as="p" style={{marginTop: '8px'}}>
                  Click "Auto-Register Webhooks" button above to automatically create webhooks via
                  Shopify API.
                </Text>
              </div>

              <div style={{marginTop: '24px'}}>
                <Text variant="headingMd" as="h3">
                  Option 2: Manual Setup
                </Text>
                <ol style={{marginTop: '8px', marginLeft: '20px'}}>
                  {webhookInstructions.steps.map(step => (
                    <li key={step.step} style={{marginBottom: '12px'}}>
                      <Text variant="bodySm" as="p" fontWeight="semibold">
                        {step.title}
                      </Text>
                      {step.description && (
                        <Text variant="bodySm" as="p" tone="subdued">
                          {step.description}
                        </Text>
                      )}
                      {step.details && (
                        <div
                          style={{
                            marginTop: '4px',
                            padding: '8px',
                            background: '#f6f6f7',
                            borderRadius: '4px'
                          }}
                        >
                          <List type="bullet">
                            {Object.entries(step.details).map(([key, value]) => (
                              <List.Item key={key}>
                                <strong>{key}:</strong> {value}
                              </List.Item>
                            ))}
                          </List>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {webhookInstructions.registeredWebhooks?.length > 0 && (
                <div style={{marginTop: '24px'}}>
                  <Text variant="headingMd" as="h3">
                    Registered Webhooks:
                  </Text>
                  <List type="bullet">
                    {webhookInstructions.registeredWebhooks.map(webhook => (
                      <List.Item key={webhook.id}>
                        <strong>{webhook.topic}</strong> - ID: {webhook.shopifyWebhookId}
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}

              <div style={{marginTop: '24px'}}>
                <Banner>
                  <p>
                    <strong>Key Points:</strong>
                  </p>
                  <List type="bullet">
                    {webhookInstructions.notes.map((note, idx) => (
                      <List.Item key={idx}>{note}</List.Item>
                    ))}
                  </List>
                </Banner>
              </div>
            </div>
          )}
        </Modal.Section>
      </Modal>

      {/* Webhook List Modal */}
      <Modal
        large
        open={showWebhookListModal}
        onClose={() => setShowWebhookListModal(false)}
        title="Webhook List"
        secondaryActions={[
          {
            content: 'Refresh',
            onAction: fetchWebhookList
          },
          {
            content: 'Close',
            onAction: () => setShowWebhookListModal(false)
          }
        ]}
      >
        <Modal.Section>
          {webhookList && (
            <div>
              <div style={{marginBottom: '16px'}}>
                <Text variant="headingMd" as="h3">
                  Store: {webhookList.storeName}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  {webhookList.shopDomain}.myshopify.com
                </Text>
              </div>

              {/* Shopify Webhooks */}
              <div style={{marginTop: '24px'}}>
                <Text variant="headingMd" as="h3">
                  Webhooks from Shopify ({webhookList.shopify?.length || 0})
                </Text>
                {webhookList.shopify && webhookList.shopify.length > 0 ? (
                  <div style={{marginTop: '12px'}}>
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text']}
                      headings={['Topic', 'Address', 'Format', 'API Version']}
                      rows={webhookList.shopify.map(webhook => [
                        webhook.topic || 'N/A',
                        webhook.address || 'N/A',
                        webhook.format || 'JSON',
                        webhook.api_version || 'N/A'
                      ])}
                    />
                  </div>
                ) : (
                  <Banner tone="warning" style={{marginTop: '12px'}}>
                    No webhooks registered on Shopify
                  </Banner>
                )}
              </div>

              {/* Local Webhooks */}
              <div style={{marginTop: '24px'}}>
                <Text variant="headingMd" as="h3">
                  Locally Registered Webhooks ({webhookList.local?.length || 0})
                </Text>
                {webhookList.local && webhookList.local.length > 0 ? (
                  <div style={{marginTop: '12px'}}>
                    <DataTable
                      columnContentTypes={['text', 'text', 'text']}
                      headings={['Topic', 'Shopify ID', 'Registered At']}
                      rows={webhookList.local.map(webhook => [
                        webhook.topic || 'N/A',
                        webhook.shopifyWebhookId || 'N/A',
                        webhook.createdAt ? new Date(webhook.createdAt).toLocaleString() : 'N/A'
                      ])}
                    />
                  </div>
                ) : (
                  <Banner tone="info" style={{marginTop: '12px'}}>
                    No locally tracked webhooks
                  </Banner>
                )}
              </div>

              <div style={{marginTop: '24px'}}>
                <Banner>
                  <p>
                    <strong>Note:</strong> Shopify webhooks show all webhooks registered on your
                    Shopify store via any method (admin panel, API, etc.). Local webhooks show only
                    those registered through this app.
                  </p>
                </Banner>
              </div>
            </div>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
