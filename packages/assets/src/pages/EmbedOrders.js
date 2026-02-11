import React, {useState, useEffect, useCallback, useRef} from 'react';
import {Page, Banner, Badge, BlockStack, Modal, TextContainer, List, Text} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';
// import SyncProgressCard from './embed-orders/SyncProgressCard';
import SyncConfigurationCard from './embed-orders/SyncConfigurationCard';
import SyncHistoryTable from './embed-orders/SyncHistoryTable';

/**
 * Embedded Orders Page - Single store (from session token)
 * Features: Setup sync config, manual sync, webhook management
 */
export default function EmbedOrders() {
  // State
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
  const [addingSheet, setAddingSheet] = useState(false);
  const [webhooks, setWebhooks] = useState(null);
  const [checkingWebhooks, setCheckingWebhooks] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const pollIntervalRef = useRef(null);
  const syncingRef = useRef(false); // Use ref to avoid dependency chain

  // Google Auth & Picker (only for adding sheets)
  const {startAuth, getPickerToken} = useGoogleAuth();
  const {openPicker} = useGooglePicker();

  // Stable stopPolling - no dependencies
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchQueueStats = useCallback(async () => {
    try {
      const response = await api('/api/embed/orders/queue-stats');
      const result = await response.json();
      if (result.success) {
        setSyncJob(result.data.activeJob);
        if (result.data.activeJob?.status === 'processing') {
          if (!pollIntervalRef.current) {
            // Start polling if not already polling
            pollIntervalRef.current = setInterval(() => {
              fetchQueueStats();
            }, 10000); // Increased from 5s to 10s
          }
          setSyncing(true);
          syncingRef.current = true;
        } else if (!result.data.activeJob || result.data.activeJob.status === 'completed') {
          stopPolling();
          // Check ref instead of state to avoid stale closure
          if (result.data.activeJob?.status === 'completed' && syncingRef.current) {
            const job = result.data.activeJob;
            const failedMsg = job.failedCount > 0 ? ` (${job.failedCount} failed)` : '';
            setSuccessMessage(
              `Sync completed! ${job.successCount || 0} orders synced${failedMsg}.`
            );
            fetchSyncConfigs();
          }
          setSyncing(false);
          syncingRef.current = false;
        }
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    }
  }, [stopPolling]); // Only depends on stopPolling (which is stable)

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Mount only - fetch once
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
      const [sheetsData, configsData] = await Promise.all([sheetsRes.json(), configsRes.json()]);
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

  const handleAddSheet = async () => {
    try {
      setAddingSheet(true);
      setError(null);

      // First try to get picker token (will trigger auth if needed)
      let pickerData;
      try {
        pickerData = await getPickerToken();
      } catch (err) {
        // If no token, start auth flow first
        try {
          await startAuth();
          pickerData = await getPickerToken();
        } catch (authErr) {
          if (authErr.message !== 'Authentication window was closed') {
            throw authErr;
          }
          return;
        }
      }

      if (!pickerData) {
        setError('Failed to authenticate with Google');
        return;
      }

      // Open picker
      await openPicker({
        accessToken: pickerData.accessToken,
        appId: pickerData.appId,
        onSelect: async selectedSheet => {
          try {
            const response = await api('/api/embed/sheets', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                spreadsheetId: selectedSheet.spreadsheetId,
                name: selectedSheet.name,
                url: selectedSheet.url
              })
            });
            const result = await response.json();
            if (result.success) {
              setSuccessMessage('Sheet added successfully!');
              await fetchData();
            } else {
              setError(result.error || 'Failed to add sheet');
            }
          } catch (err) {
            setError('Failed to add sheet');
          }
        },
        onCancel: () => {
          // User cancelled picker
        }
      });
    } catch (err) {
      if (err.message !== 'Authentication window was closed') {
        setError(err.message || 'Failed to add sheet');
      }
    } finally {
      setAddingSheet(false);
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
      } else {
        setError(result.error || 'Failed to load sheet tabs');
      }
    } catch (err) {
      console.error('Error fetching sheet tabs:', err);
      setError('Failed to load sheet tabs. Please check your Google connection.');
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

  const handleCheckWebhooks = async () => {
    try {
      setCheckingWebhooks(true);
      setError(null);

      const response = await api('/api/embed/orders/webhook-list');
      const result = await response.json();

      if (result.success) {
        setWebhooks(result.data);
        setShowWebhookModal(true);
      } else {
        setError(result.error || 'Failed to fetch webhooks');
      }
    } catch (err) {
      setError('Failed to fetch webhooks');
    } finally {
      setCheckingWebhooks(false);
    }
  };

  const sheetOptions = sheets.map(sheet => ({label: sheet.name, value: sheet.id}));
  const activeConfig = syncConfigs.find(config => config.status === 'active');

  const startPolling = () => {
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        fetchQueueStats();
      }, 10000);
    }
  };

  return (
    <Page
      title="Orders Sync"
      subtitle="Export orders from Shopify to Google Sheets"
      titleMetadata={<Badge tone="info">Beta</Badge>}
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

        {/* <SyncProgressCard syncJob={syncJob} /> */}

        <SyncConfigurationCard
          activeConfig={activeConfig}
          loading={loading}
          sheets={sheets}
          sheetOptions={sheetOptions}
          selectedSheet={selectedSheet}
          onSheetChange={setSelectedSheet}
          addingSheet={addingSheet}
          onAddSheet={handleAddSheet}
          sheetTabs={sheetTabs}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          loadingTabs={loadingTabs}
          settingUpSync={settingUpSync}
          onSetupSync={handleSetupSync}
          syncing={syncing}
          syncJob={syncJob}
          onManualSync={handleManualSync}
          checkingWebhooks={checkingWebhooks}
          onCheckWebhooks={handleCheckWebhooks}
        />

        <SyncHistoryTable syncConfigs={syncConfigs} />
      </BlockStack>

      <Modal
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        title="Registered Webhooks"
        primaryAction={{
          content: 'Close',
          onAction: () => setShowWebhookModal(false)
        }}
      >
        <Modal.Section>
          {webhooks ? (
            <BlockStack gap="400">
              {webhooks.storeName && (
                <Text variant="bodyMd" fontWeight="semibold">
                  Store: {webhooks.storeName} ({webhooks.shopDomain})
                </Text>
              )}

              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Shopify Webhooks ({webhooks.shopify?.length || 0})
                </Text>
                {webhooks.shopify && webhooks.shopify.length > 0 ? (
                  <List type="bullet">
                    {webhooks.shopify.map(wh => (
                      <List.Item key={wh.id}>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">
                            {wh.topic}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            URL: {wh.address}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            ID: {wh.id} | Format: {wh.format}
                          </Text>
                        </BlockStack>
                      </List.Item>
                    ))}
                  </List>
                ) : (
                  <Banner tone="warning">
                    No webhooks registered on Shopify. Orders will not sync automatically.
                  </Banner>
                )}
              </BlockStack>

              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Local Database ({webhooks.local?.length || 0})
                </Text>
                {webhooks.local && webhooks.local.length > 0 ? (
                  <List type="bullet">
                    {webhooks.local.map(wh => (
                      <List.Item key={wh.id}>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">
                            {wh.topic}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            URL: {wh.address}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            Shopify ID: {wh.shopifyWebhookId}
                          </Text>
                        </BlockStack>
                      </List.Item>
                    ))}
                  </List>
                ) : (
                  <Banner tone="info">No webhooks tracked in local database.</Banner>
                )}
              </BlockStack>
            </BlockStack>
          ) : (
            <Text>Loading webhook information...</Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
