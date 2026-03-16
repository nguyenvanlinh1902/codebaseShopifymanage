import React, {useState, useEffect} from 'react';
import {Page, Layout, Banner} from '@shopify/polaris';
import {useTrackingStatusApi} from '../../hooks/use-tracking-status-api';
import ApiKeysTab from './ApiKeysTab';

/**
 * Standalone page for managing 17TRACK API keys
 */
export default function TrackingApiKeysPage() {
  const trackingApi = useTrackingStatusApi();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    trackingApi.fetchApiKeys().catch(err => setError(err.message));
  }, [trackingApi.fetchApiKeys]);

  const handleCreate = async (keyData) => {
    try {
      setError(null);
      await trackingApi.createApiKey(keyData);
      setSuccess('API key created');
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      setError(null);
      await trackingApi.updateApiKey(id, updates);
      setSuccess('API key updated');
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSyncQuota = async (id) => {
    try {
      setError(null);
      const quota = await trackingApi.syncKeyQuota(id);
      setSuccess(`Quota synced: ${quota.quotaRemain} remaining`);
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSyncAllQuota = async () => {
    try {
      setError(null);
      const results = await trackingApi.syncAllKeysQuota();
      const failed = results.filter(r => !r.success);
      if (failed.length) {
        setSuccess(`Synced ${results.length - failed.length}/${results.length} keys`);
        setError(`Failed: ${failed.map(f => f.name).join(', ')}`);
      } else {
        setSuccess(`All ${results.length} keys synced`);
      }
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      setError(null);
      await trackingApi.deleteApiKey(id);
      setSuccess('API key deleted');
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
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
            apiKeys={trackingApi.apiKeys}
            loading={trackingApi.keysLoading}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onSyncQuota={handleSyncQuota}
            onSyncAll={handleSyncAllQuota}
            onRefresh={trackingApi.fetchApiKeys}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
