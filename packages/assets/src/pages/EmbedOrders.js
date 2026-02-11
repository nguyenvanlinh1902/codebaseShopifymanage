import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  Card,
  Select,
  Button,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  Spinner,
  BlockStack,
  InlineStack,
  Box,
  Icon,
  EmptyState
} from '@shopify/polaris';
import {OrderIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';

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

        {/* Sync Progress */}
        {syncJob && syncJob.status === 'processing' && (
          <Card>
            <InlineStack gap="400" blockAlign="center">
              <Spinner size="small" />
              <BlockStack gap="050">
                <Text variant="headingSm" as="h3" fontWeight="semibold">
                  Syncing orders...
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {syncJob.successCount || 0} orders synced
                  {syncJob.currentPage ? ` (page ${syncJob.currentPage})` : ''}
                </Text>
              </BlockStack>
            </InlineStack>
          </Card>
        )}

        {/* Sync Configuration */}
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                <Icon source={OrderIcon} />
              </Box>
              <Text variant="headingMd" as="h2">
                {activeConfig ? 'Sync Configuration' : 'Setup Sync'}
              </Text>
            </InlineStack>

            {activeConfig && (
              <Banner tone="info">
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold">
                    Sheet: {activeConfig.sheetName} / Tab: {activeConfig.targetSheet}
                  </Text>
                  <Text variant="bodySm">
                    {activeConfig.totalOrdersSynced || 0} orders synced
                    {activeConfig.lastSyncAt &&
                      ` \u00B7 Last: ${new Date(activeConfig.lastSyncAt).toLocaleString()}`}
                  </Text>
                </BlockStack>
              </Banner>
            )}

            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : sheets.length === 0 ? (
              <EmptyState
                heading="Connect Google Sheets"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <BlockStack gap="400">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Connect your Google account and select a spreadsheet to start syncing orders.
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    <Badge tone="info">Beta</Badge> Google Sheets integration is currently in beta.
                  </Text>
                  <InlineStack gap="200" align="center">
                    <Button variant="primary" onClick={handleAddSheet} loading={addingSheet}>
                      Connect & Select Sheet
                    </Button>
                  </InlineStack>
                </BlockStack>
              </EmptyState>
            ) : (
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="end" wrap={false}>
                  <Box width="100%">
                    <Select
                      label="Select Google Sheet"
                      options={sheetOptions}
                      value={selectedSheet}
                      onChange={setSelectedSheet}
                      placeholder="Choose a sheet"
                    />
                  </Box>
                  <Box minWidth="fit-content" paddingBlockEnd="025">
                    <Button onClick={handleAddSheet} loading={addingSheet}>
                      Add Sheet
                    </Button>
                  </Box>
                </InlineStack>

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

                <InlineStack gap="200" wrap>
                  <Button
                    variant="primary"
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
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Sync History Table */}
        {syncConfigs.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Sync History
              </Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
                headings={['Sheet', 'Target Tab', 'Status', 'Orders Synced', 'Last Sync']}
                rows={configRows}
              />
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
