import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  Layout,
  Tabs,
  Banner,
  Card,
  InlineStack,
  Button,
  Modal,
  ChoiceList,
  BlockStack,
  Text,
  Badge
} from '@shopify/polaris';
import {useTrackingStatusApi} from '../hooks/use-tracking-status-api';
import useRecheckProgress from '../hooks/use-recheck-progress';
import DashboardStatsTab from './tracking-status/DashboardStatsTab';
import StatusListTab from './tracking-status/StatusListTab';
import ApiKeysTab from './tracking-status/ApiKeysTab';
import ManualCheckTab from './tracking-status/ManualCheckTab';

/**
 * Tracking Status Page - Dashboard, History, API Keys
 * Orders Check is a separate page at /tracking-orders-check
 */
export default function TrackingStatus() {
  const trackingApi = useTrackingStatusApi();
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Statuses (local filter state)
  const [statusFilter, setStatusFilter] = useState('');
  const [statusPage, setStatusPage] = useState(1);
  const [statusPerPage, setStatusPerPage] = useState(10);
  const [statusSearch, setStatusSearch] = useState('');

  // Trigger + recheck progress
  const [triggering, setTriggering] = useState(false);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckModalOpen, setRecheckModalOpen] = useState(false);
  const [recheckStatuses, setRecheckStatuses] = useState(['pending', 'in_transit', 'not_found']);
  const [recheckJobId, setRecheckJobId] = useState(null);
  const {job: recheckJob, clearJob: clearRecheckJob} = useRecheckProgress(recheckJobId);

  const tabs = [
    { id: 'dashboard', content: 'Dashboard' },
    { id: 'statuses', content: 'History' },
    { id: 'manual-check', content: 'Manual Check' },
    { id: 'api-keys', content: 'API Keys' }
  ];

  const fetchStatuses = useCallback(async () => {
    const params = {
      all: '1',
      page: statusPage, perPage: statusPerPage, search: statusSearch
    };
    if (statusFilter === '__stale__') {
      params.stale = '1';
    } else if (statusFilter) {
      params.status = statusFilter;
    }
    try {
      await trackingApi.fetchStatuses(params);
    } catch (err) {
      setError(err.message);
    }
  }, [statusFilter, statusPage, statusPerPage, statusSearch, trackingApi.fetchStatuses]);

  useEffect(() => {
    if (selectedTab === 0) trackingApi.fetchStats().catch(() => { });
    if (selectedTab === 1) fetchStatuses();
    if (selectedTab === 2) trackingApi.fetchApiKeys().catch(() => { });
    if (selectedTab === 3) trackingApi.fetchApiKeys().catch(() => { });
  }, [selectedTab]);

  // Single effect: fetch + auto-reset page when filters change
  const statusFiltersRef = useRef({
    statusFilter, statusPerPage, statusSearch
  });
  useEffect(() => {
    if (selectedTab !== 1) return;
    const prev = statusFiltersRef.current;
    const filtersChanged =
      prev.statusFilter !== statusFilter ||
      prev.statusPerPage !== statusPerPage ||
      prev.statusSearch !== statusSearch;
    statusFiltersRef.current = {statusFilter, statusPerPage, statusSearch};

    if (filtersChanged && statusPage !== 1) {
      setStatusPage(1);
      return;
    }
    fetchStatuses();
  }, [statusFilter, statusPage, statusPerPage, statusSearch]);

  const handleTrigger = async (selectedStatuses) => {
    try {
      setTriggering(true);
      setError(null);
      const d = await trackingApi.triggerRecheck(selectedStatuses);
      setSuccess(`Cycle complete: ${d.registered} registered, ${d.queried} queried, ${d.updated} updated`);
      trackingApi.fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleRecheck = async (selectedStatuses) => {
    try {
      setRecheckLoading(true);
      setError(null);
      setSuccess(null);
      const d = await trackingApi.triggerRecheck(selectedStatuses);
      if (d.jobId) {
        setRecheckJobId(d.jobId);
      } else {
        setSuccess('No trackings to recheck');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRecheckLoading(false);
    }
  };

  // When recheck job completes, refresh data
  useEffect(() => {
    if (!recheckJob || recheckJob.status !== 'completed') return;
    setRecheckLoading(false);
    setSuccess(
      `Recheck complete: ${recheckJob.totalRegistered || 0} registered, ` +
        `${recheckJob.totalQueried || 0} queried, ${recheckJob.totalUpdated || 0} updated`
    );
    fetchStatuses();
    trackingApi.fetchStats();
    const timer = setTimeout(() => {
      setRecheckJobId(null);
      clearRecheckJob();
    }, 8000);
    return () => clearTimeout(timer);
  }, [recheckJob?.status]);

  const handleClearInvalid = async () => {
    try {
      setError(null);
      const d = await trackingApi.clearInvalid();
      setSuccess(`Cleared ${d.deleted} invalid tracking(s)`);
      fetchStatuses();
      trackingApi.fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateKey = async (keyData) => {
    try {
      setError(null);
      await trackingApi.createApiKey(keyData);
      setSuccess('API key created');
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateKey = async (id, updates) => {
    try {
      setError(null);
      await trackingApi.updateApiKey(id, updates);
      setSuccess('API key updated');
      trackingApi.fetchApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteKey = async (id) => {
    try {
      setError(null);
      await trackingApi.deleteApiKey(id);
      setSuccess('API key deleted');
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

  return (
    <Page title="Tracking Status" subtitle="17TRACK tracking status automation" fullWidth>
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

        {recheckJob && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    {recheckJob.status === 'completed'
                      ? 'Recheck Complete'
                      : 'Rechecking...'}
                  </Text>
                  <Badge
                    tone={recheckJob.status === 'completed' ? 'success' : 'attention'}
                  >
                    {recheckJob.totalGroups
                      ? Math.round((recheckJob.processedGroups / recheckJob.totalGroups) * 100)
                      : 0}
                    %
                  </Badge>
                </InlineStack>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e4e5e7',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${recheckJob.totalGroups ? Math.round((recheckJob.processedGroups / recheckJob.totalGroups) * 100) : 0}%`,
                      height: '100%',
                      backgroundColor: '#008060',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                <InlineStack gap="400">
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.processedGroups}/{recheckJob.totalGroups} groups
                  </Text>
                  <Text variant="bodySm" tone="success">
                    {recheckJob.totalUpdated || 0} updated
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.totalRegistered || 0} registered
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {recheckJob.totalQueried || 0} queried
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {selectedTab === 1 && (
          <Layout.Section>
            <Card>
              <InlineStack gap="300" blockAlign="end" wrap={false}>
                <Button onClick={fetchStatuses} disabled={trackingApi.statusesLoading}>
                  Refresh
                </Button>
                <Button tone="critical" onClick={handleClearInvalid}>
                  Clear Invalid
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setRecheckModalOpen(true)}
                  loading={recheckLoading}
                >
                  Recheck All
                </Button>
              </InlineStack>
            </Card>
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
                stats={trackingApi.stats}
                loading={trackingApi.statsLoading}
                triggering={triggering}
                onTrigger={handleTrigger}
                onRefresh={trackingApi.fetchStats}
              />
            )}
            {selectedTab === 1 && (
              <StatusListTab
                statuses={trackingApi.statuses}
                loading={trackingApi.statusesLoading}
                statusFilter={statusFilter}
                onFilterChange={setStatusFilter}
                pagination={trackingApi.statusPagination}
                page={statusPage}
                perPage={statusPerPage}
                search={statusSearch}
                onPageChange={setStatusPage}
                onPerPageChange={setStatusPerPage}
                onSearchChange={setStatusSearch}
                onHide={async (id) => {
                  await trackingApi.hideTracking(id);
                  fetchStatuses();
                }}
              />
            )}
            {selectedTab === 2 && (
              <ManualCheckTab
                apiKeys={trackingApi.apiKeys}
                onCheckSingle={trackingApi.checkSingleTracking}
                loading={trackingApi.actionLoading}
              />
            )}
            {selectedTab === 3 && (
              <ApiKeysTab
                apiKeys={trackingApi.apiKeys}
                loading={trackingApi.keysLoading}
                onCreate={handleCreateKey}
                onUpdate={handleUpdateKey}
                onDelete={handleDeleteKey}
                onSyncQuota={handleSyncQuota}
                onSyncAll={handleSyncAllQuota}
                onRefresh={trackingApi.fetchApiKeys}
              />
            )}
          </Tabs>
        </Layout.Section>
      </Layout>

      <Modal
        open={recheckModalOpen}
        onClose={() => setRecheckModalOpen(false)}
        title="Recheck Tracking Status"
        primaryAction={{
          content: `Recheck (${recheckStatuses.length} status${recheckStatuses.length !== 1 ? 'es' : ''})`,
          onAction: () => {
            if (recheckStatuses.length > 0) handleRecheck(recheckStatuses);
            setRecheckModalOpen(false);
          },
          loading: recheckLoading,
          disabled: recheckStatuses.length === 0
        }}
        secondaryActions={[
          {content: 'Cancel', onAction: () => setRecheckModalOpen(false)}
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text>Select which statuses to recheck via 17TRACK:</Text>
            <ChoiceList
              allowMultiple
              title="Statuses"
              titleHidden
              choices={[
                {label: 'Pending', value: 'pending'},
                {label: 'In Transit', value: 'in_transit'},
                {label: 'Not Found', value: 'not_found'},
                {label: 'Pick Up', value: 'pick_up'},
                {label: 'Undelivered', value: 'undelivered'},
                {label: 'Alert', value: 'alert'}
              ]}
              selected={recheckStatuses}
              onChange={setRecheckStatuses}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
