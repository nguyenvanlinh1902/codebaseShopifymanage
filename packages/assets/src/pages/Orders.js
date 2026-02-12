import React, {useState, useEffect} from 'react';
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
  BlockStack
} from '@shopify/polaris';
import {api} from '../helpers/api';

/**
 * Orders Sync Page - Setup which Google Sheet to sync orders to.
 * Webhooks are auto-registered on app install.
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
  const [settingUpSync, setSettingUpSync] = useState(false);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [filterStore, setFilterStore] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);


  useEffect(() => {
    fetchData();
  }, []);

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

      if (storesData.success) setStores(storesData.data);
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
      if (result.success) setSyncConfigs(result.data);
    } catch (err) {
      console.error('Error fetching sync configs:', err);
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
        setSuccessMessage('Order sync configured successfully! New orders will auto-sync to this sheet.');
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

  const storeOptions = stores.map(store => ({label: store.name, value: store.id}));
  const sheetOptions = sheets.map(sheet => ({label: sheet.name, value: sheet.id}));
  const filterStoreOptions = [{label: 'All Stores', value: ''}, ...storeOptions];

  // Filter configs by store
  const filteredConfigs = filterStore
    ? syncConfigs.filter(c => c.storeId === filterStore)
    : syncConfigs;

  const configRows = filteredConfigs.map(config => [
    config.storeName || 'N/A',
    config.sheetName || 'N/A',
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
                  columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text']}
                  headings={['Store', 'Google Sheet', 'Tab', 'Status', 'Orders Synced', 'Last Sync']}
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
