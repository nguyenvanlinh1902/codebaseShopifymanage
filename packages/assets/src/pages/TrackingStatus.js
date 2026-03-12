import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Tabs,
  Banner
} from '@shopify/polaris';
import {api} from '../helpers/api';
import DashboardStatsTab from './tracking-status/DashboardStatsTab';
import StatusListTab from './tracking-status/StatusListTab';
import ApiKeysTab from './tracking-status/ApiKeysTab';

/**
 * Tracking Status Page - Dashboard, History, API Keys
 * Orders Check is a separate page at /tracking-orders-check
 */
export default function TrackingStatus() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Dashboard stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Statuses
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusLimit, setStatusLimit] = useState('100');

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(false);

  // Trigger
  const [triggering, setTriggering] = useState(false);

  const tabs = [
    {id: 'dashboard', content: 'Dashboard'},
    {id: 'statuses', content: 'History'},
    {id: 'api-keys', content: 'API Keys'}
  ];

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api('/api/tracking-status/stats');
      const data = await res.json();
      if (data.success) setStats(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      setStatusesLoading(true);
      const params = new URLSearchParams({limit: statusLimit});
      if (statusFilter) params.set('status', statusFilter);
      const res = await api(`/api/tracking-status/statuses?${params}`);
      const data = await res.json();
      if (data.success) setStatuses(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch statuses');
    } finally {
      setStatusesLoading(false);
    }
  }, [statusFilter, statusLimit]);

  const fetchApiKeys = useCallback(async () => {
    try {
      setKeysLoading(true);
      const res = await api('/api/tracking-status/keys');
      const data = await res.json();
      if (data.success) setApiKeys(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch API keys');
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === 0) fetchStats();
    if (selectedTab === 1) fetchStatuses();
    if (selectedTab === 2) fetchApiKeys();
  }, [selectedTab]);

  useEffect(() => {
    if (selectedTab === 1) fetchStatuses();
  }, [statusFilter, statusLimit]);

  const handleTrigger = async () => {
    try {
      setTriggering(true);
      setError(null);
      const res = await api('/api/tracking-status/trigger', {method: 'POST'});
      const data = await res.json();
      if (data.success) {
        setSuccess(`Cycle complete: ${data.data.registered} registered, ${data.data.queried} queried, ${data.data.updated} updated`);
        fetchStats();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to trigger status check');
    } finally {
      setTriggering(false);
    }
  };

  const handleCreateKey = async (keyData) => {
    try {
      setError(null);
      const res = await api('/api/tracking-status/keys', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(keyData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('API key created');
        fetchApiKeys();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to create API key');
    }
  };

  const handleUpdateKey = async (id, updates) => {
    try {
      setError(null);
      const res = await api(`/api/tracking-status/keys/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('API key updated');
        fetchApiKeys();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to update API key');
    }
  };

  const handleDeleteKey = async (id) => {
    try {
      setError(null);
      const res = await api(`/api/tracking-status/keys/${id}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) {
        setSuccess('API key deleted');
        fetchApiKeys();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to delete API key');
    }
  };

  return (
    <Page title="Tracking Status" subtitle="17TRACK tracking status automation">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}
        {success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={i => {
              setSelectedTab(i);
              setError(null);
              setSuccess(null);
            }}
          >
            {selectedTab === 0 && (
              <DashboardStatsTab
                stats={stats}
                loading={statsLoading}
                triggering={triggering}
                onTrigger={handleTrigger}
                onRefresh={fetchStats}
              />
            )}
            {selectedTab === 1 && (
              <StatusListTab
                statuses={statuses}
                loading={statusesLoading}
                statusFilter={statusFilter}
                onFilterChange={setStatusFilter}
                statusLimit={statusLimit}
                onLimitChange={setStatusLimit}
                onRefresh={fetchStatuses}
              />
            )}
            {selectedTab === 2 && (
              <ApiKeysTab
                apiKeys={apiKeys}
                loading={keysLoading}
                onCreate={handleCreateKey}
                onUpdate={handleUpdateKey}
                onDelete={handleDeleteKey}
                onRefresh={fetchApiKeys}
              />
            )}
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
