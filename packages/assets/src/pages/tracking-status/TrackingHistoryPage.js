import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layout, Banner } from '@shopify/polaris';
import {api} from '../../helpers/api';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import {useTrackingStatusApi} from '../../hooks/use-tracking-status-api';
import StatusListTab from './StatusListTab';

/**
 * Standalone page for tracking status history.
 * Requires store or group selection before fetching.
 */
export default function TrackingHistoryPage() {
  const {stores, groups} = usePermittedStores();
  const trackingApi = useTrackingStatusApi();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('store');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusLimit, setStatusLimit] = useState('100');

  const fetchStatuses = useCallback(async () => {
    const params = new URLSearchParams({ limit: statusLimit });
    if (statusFilter) params.set('status', statusFilter);

    if (filterType === 'store' && selectedStore) {
      params.set('storeId', selectedStore);
    } else if (filterType === 'group' && selectedGroup) {
      const group = groups.find(g => g.id === selectedGroup);
      const groupStoreIds = stores
        .filter(s => s.groupId === selectedGroup || s.group === group?.name)
        .map(s => s.id);
      if (!groupStoreIds.length) {
        setStatuses([]);
        return;
      }
      params.set('storeIds', groupStoreIds.join(','));
    } else {
      return; // No selection yet
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api(`/api/tracking-status/statuses?${params}`);
      const data = await res.json();
      if (data.success) setStatuses(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch statuses');
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedStore, selectedGroup, statusFilter, statusLimit, stores, groups]);

  // Auto-fetch when selection changes
  useEffect(() => {
    if ((filterType === 'store' && selectedStore) || (filterType === 'group' && selectedGroup)) {
      fetchStatuses();
    }
  }, [fetchStatuses, filterType, selectedStore, selectedGroup]);

  return (
    <Page title="Tracking History" subtitle="All tracked shipments and their statuses">
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
      )}
      <StatusListTab
        statuses={statuses}
        loading={loading}
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        statusLimit={statusLimit}
        onLimitChange={setStatusLimit}
        onRefresh={fetchStatuses}
        stores={stores}
        groups={groups}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        selectedStore={selectedStore}
        onStoreChange={setSelectedStore}
        selectedGroup={selectedGroup}
        onGroupChange={setSelectedGroup}
        onRemove={async id => {
          await trackingApi.removeTracking(id);
          fetchStatuses();
        }}
      />
    </Page>
  );
}
