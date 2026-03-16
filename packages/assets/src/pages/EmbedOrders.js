import React, {useState, useEffect, useRef} from 'react';
import {Page, Banner, Badge, BlockStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';
import SyncConfigurationCard from './embed-orders/SyncConfigurationCard';
import SyncHistoryTable from './embed-orders/SyncHistoryTable';

/**
 * Embedded Orders Page - Single store (from session token)
 * Setup which Google Sheet to sync orders to. Webhooks auto-registered on install.
 */
export default function EmbedOrders() {
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingUpSync, setSettingUpSync] = useState(false);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [addingSheet, setAddingSheet] = useState(false);
  const [syncPagination, setSyncPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [syncPage, setSyncPage] = useState(1);
  const [syncPerPage, setSyncPerPage] = useState(10);
  const [syncSearch, setSyncSearch] = useState('');
  const [syncFetching, setSyncFetching] = useState(false);

  const {startAuth, getPickerToken} = useGoogleAuth();
  const {openPicker} = useGooglePicker();

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

  // Single effect: fetch + auto-reset page when filters change
  const syncFiltersRef = useRef({syncPerPage, syncSearch});
  useEffect(() => {
    const prev = syncFiltersRef.current;
    const filtersChanged =
      prev.syncPerPage !== syncPerPage ||
      prev.syncSearch !== syncSearch;
    syncFiltersRef.current = {syncPerPage, syncSearch};

    if (filtersChanged && syncPage !== 1) {
      setSyncPage(1);
      return;
    }
    fetchSyncConfigs();
  }, [syncPage, syncPerPage, syncSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({page: syncPage, perPage: syncPerPage, search: syncSearch});
      const [sheetsRes, configsRes] = await Promise.all([
        api('/api/embed/sheets'),
        api(`/api/embed/orders/sync-configs?${params}`)
      ]);
      const [sheetsData, configsData] = await Promise.all([sheetsRes.json(), configsRes.json()]);
      if (sheetsData.success) setSheets(sheetsData.data);
      if (configsData.success) {
        setSyncConfigs(configsData.data);
        if (configsData.pagination) setSyncPagination(configsData.pagination);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncConfigs = async () => {
    try {
      setSyncFetching(true);
      const params = new URLSearchParams({page: syncPage, perPage: syncPerPage, search: syncSearch});
      const response = await api(`/api/embed/orders/sync-configs?${params}`);
      const result = await response.json();
      if (result.success) {
        setSyncConfigs(result.data);
        if (result.pagination) setSyncPagination(result.pagination);
      }
    } catch (err) {
      console.error('Error fetching sync configs:', err);
    } finally {
      setSyncFetching(false);
    }
  };

  const handleAddSheet = async () => {
    try {
      setAddingSheet(true);
      setError(null);

      let pickerData;
      try {
        pickerData = await getPickerToken();
      } catch (err) {
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
        onCancel: () => {}
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
        setSuccessMessage('Order sync configured successfully! New orders will auto-sync to this sheet.');
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

  const sheetOptions = sheets.map(sheet => ({label: sheet.name, value: sheet.id}));
  const activeConfig = syncConfigs.find(config => config.status === 'active');

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
        />

        <SyncHistoryTable
          syncConfigs={syncConfigs}
          loading={syncFetching}
          pagination={syncPagination}
          page={syncPage}
          perPage={syncPerPage}
          search={syncSearch}
          onPageChange={setSyncPage}
          onPerPageChange={setSyncPerPage}
          onSearchChange={setSyncSearch}
        />
      </BlockStack>
    </Page>
  );
}
