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
import {usePermittedStores} from '../hooks/usePermittedStores';

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
      const sheetsRes = await api('/api/sheets');
      const sheetsData = await sheetsRes.json();

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

  // Filter configs by store and status
  const filteredConfigs = syncConfigs.filter(c => {
    if (filterStore && c.storeId !== filterStore) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const configRows = filteredConfigs.map(config => [
    config.storeName || 'N/A',
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
        onAction: () => setShowSetupModal(true),
        loading: loading,
        disabled: loading
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
                    <Select
                      label="Filter by store"
                      labelHidden
                      options={filterStoreOptions}
                      value={filterStore}
                      onChange={setFilterStore}
                    />
                  </div>
                </InlineStack>
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
                  headings={[
                    'Store',
                    'Google Sheet',
                    'Tab',
                    'Status',
                    'Orders Synced',
                    'Last Sync'
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
