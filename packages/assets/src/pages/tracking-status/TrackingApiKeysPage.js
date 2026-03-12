import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Banner} from '@shopify/polaris';
import {api} from '../../helpers/api';
import ApiKeysTab from './ApiKeysTab';

/**
 * Standalone page for managing 17TRACK API keys
 */
export default function TrackingApiKeysPage() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/tracking-status/keys');
      const data = await res.json();
      if (data.success) setApiKeys(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);

  const handleCreate = async (keyData) => {
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

  const handleUpdate = async (id, updates) => {
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

  const handleSyncQuota = async (id) => {
    try {
      setError(null);
      const res = await api(`/api/tracking-status/keys/${id}/sync-quota`, {method: 'POST'});
      const data = await res.json();
      if (data.success) {
        setSuccess(`Quota synced: ${data.data.quotaRemain} remaining`);
        fetchApiKeys();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to sync quota');
    }
  };

  const handleDelete = async (id) => {
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
    <Page title="17TRACK API Keys" subtitle="Manage API keys for tracking status checks">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}
        {success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <ApiKeysTab
            apiKeys={apiKeys}
            loading={loading}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onSyncQuota={handleSyncQuota}
            onRefresh={fetchApiKeys}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
