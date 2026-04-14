import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Select,
  TextField,
  IndexTable,
  Badge,
  SkeletonBodyText,
  Banner
} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import useTrackingCheckProgress from '../../hooks/use-tracking-check-progress';

const STATUS_TONE_MAP = {
  pending: 'attention',
  info_received: 'info',
  in_transit: 'info',
  delivered: 'success',
  expired: undefined,
  not_found: 'warning',
  pick_up: 'info',
  undelivered: 'warning',
  alert: 'critical'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function OrdersCheckPage() {
  const {stores, groups, loading: storesLoading} = usePermittedStores();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [filterType, setFilterType] = useState('store');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');

  // Job progress via Firestore onSnapshot (like Import Product)
  const [jobId, setJobId] = useState(null);
  const {job, clearJob} = useTrackingCheckProgress(jobId);

  // Fetch API keys
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/tracking-status/keys');
        const data = await res.json();
        if (data.success) setApiKeys(data.data);
      } catch { /* ignore */ }
    })();
  }, []);

  // Auto-select first store
  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].id);
    }
  }, [stores]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup && filterType === 'group') {
      setSelectedGroup(groups[0].id);
    }
  }, [groups, filterType]);

  // Build query params
  const getQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterType === 'all') {
      const ids = stores.map(s => s.id).filter(Boolean);
      if (ids.length) params.set('storeIds', ids.join(','));
    } else if (filterType === 'store' && selectedStore) {
      params.set('storeId', selectedStore);
    } else if (filterType === 'group' && selectedGroup) {
      const group = groups.find(g => g.id === selectedGroup);
      if (group?.storeIds?.length > 0) {
        params.set('storeIds', group.storeIds.join(','));
      }
    }
    return params;
  }, [filterType, selectedStore, selectedGroup, groups, stores]);

  const hasValidSelection = filterType === 'all'
    || (filterType === 'store' ? !!selectedStore : !!selectedGroup);

  // Fetch orders from Shopify
  const fetchOrders = useCallback(async () => {
    if (!hasValidSelection) return;
    try {
      setLoading(true);
      setError(null);
      const params = getQueryParams();
      const res = await api(`/api/tracking-status/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [hasValidSelection, getQueryParams]);

  // Auto-fetch when selection changes
  useEffect(() => {
    if (hasValidSelection) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [selectedStore, selectedGroup, filterType]);

  // When job completes, refresh orders and show success
  useEffect(() => {
    if (!job || job.status !== 'completed') return;
    setChecking(false);
    setSuccess(
      `Check complete: ${job.totalRegistered || 0} registered, ` +
      `${job.totalQueried || 0} queried, ${job.totalUpdated || 0} updated`
    );
    fetchOrders();
    // Auto-dismiss after 8s
    const timer = setTimeout(() => {
      setJobId(null);
      clearJob();
    }, 8000);
    return () => clearTimeout(timer);
  }, [job?.status]);

  // Trigger 17TRACK check via PubSub (background processing)
  const handleCheckStatus = useCallback(async () => {
    if (!hasValidSelection) return;
    try {
      setChecking(true);
      setError(null);
      setSuccess(null);
      setJobId(null);
      clearJob();

      const body = {};
      if (selectedKeyId) body.keyId = selectedKeyId;
      if (filterType === 'all') {
        body.storeIds = stores.map(s => s.id);
      } else if (filterType === 'store' && selectedStore) {
        body.storeId = selectedStore;
      } else if (filterType === 'group' && selectedGroup) {
        const group = groups.find(g => g.id === selectedGroup);
        if (group?.storeIds?.length > 0) {
          body.storeIds = group.storeIds;
        }
      }

      const res = await api('/api/tracking-status/check-orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success && data.data.jobId) {
        // Start watching job progress via Firestore onSnapshot
        setJobId(data.data.jobId);
      } else if (data.success) {
        setChecking(false);
        setSuccess('No stores to check');
      } else {
        setChecking(false);
        setError(data.error);
      }
    } catch {
      setChecking(false);
      setError('Failed to trigger status check');
    }
  }, [
    hasValidSelection, filterType, selectedStore,
    selectedGroup, groups, stores, clearJob
  ]);

  // Recheck All (uses trigger endpoint)
  const handleRecheckAll = useCallback(async () => {
    try {
      setRecheckLoading(true);
      setError(null);
      setSuccess(null);
      const res = await api('/api/tracking-status/trigger', {method: 'POST'});
      const data = await res.json();
      if (data.success) {
        const d = data.data;
        setSuccess(
          `Recheck complete: ${d.registered} registered, ` +
          `${d.queried} queried, ${d.updated} updated`
        );
        fetchOrders();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to trigger recheck');
    } finally {
      setRecheckLoading(false);
    }
  }, [fetchOrders]);

  // Check single tracking
  const handleCheckSingle = useCallback(async (item) => {
    const key = `${item.trackingNumber}-${item.storeId}`;
    try {
      setCheckingId(key);
      setError(null);
      const res = await api('/api/tracking-status/check-single', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          trackingNumber: item.trackingNumber,
          carrier: item.carrier,
          orderNumber: item.orderNumber,
          storeId: item.storeId,
          ...(selectedKeyId && {keyId: selectedKeyId})
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.warnings?.length > 0) {
          setError(data.warnings.join(' | '));
        }
        setOrders(prev => prev.map(o =>
          o.trackingNumber === item.trackingNumber && o.storeId === item.storeId
            ? {
              ...o,
              inHistory: true,
              status: data.data.status,
              lastEvent: data.data.lastEvent,
              lastCheckedAt: data.data.lastCheckedAt,
              isDelivered: data.data.isDelivered,
              apiKeyName: data.data.apiKeyName
            }
            : o
        ));
      } else {
        setError(data.error);
      }
    } catch {
      setError(`Failed to check ${item.trackingNumber}`);
    } finally {
      setCheckingId(null);
    }
  }, [selectedKeyId]);

  // Store name lookup
  const storeNameMap = {};
  stores.forEach(s => {
    storeNameMap[s.id] = s.name || s.shopDomain || s.id;
  });

  const storeOptions = [
    {label: 'Choose store', value: ''},
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];
  const groupOptions = [
    {label: 'Choose group', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];
  const filterOptions = [
    {label: 'All Stores', value: 'all'},
    {label: 'Store', value: 'store'},
    ...(groups.length > 0 ? [{label: 'Group', value: 'group'}] : [])
  ];

  // Search filter
  const filteredOrders = searchQuery
    ? orders.filter(o => {
      const q = searchQuery.toLowerCase();
      return (
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.trackingNumber || '').toLowerCase().includes(q)
      );
    })
    : orders;

  // Stats
  const newCount = filteredOrders.filter(o => !o.inHistory).length;
  const existingCount = filteredOrders.filter(o => o.inHistory).length;
  const deliveredCount = filteredOrders.filter(o => o.isDelivered).length;

  // Progress from job doc
  const progressPercent = job?.totalStores
    ? Math.round((job.processedStores / job.totalStores) * 100)
    : 0;
  const currentStore = job?.stores?.find(s => s.status === 'pending');

  const rowMarkup = filteredOrders.map((item, index) => {
    const rowKey = `${item.trackingNumber}-${item.storeId}`;
    const isCheckingThis = checkingId === rowKey;
    return (
      <IndexTable.Row
        id={`${item.trackingNumber}-${index}`}
        key={`${item.trackingNumber}-${index}`}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold">
            {item.orderNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm">
            {storeNameMap[item.storeId] || item.storeDomain || '—'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" fontWeight="semibold">
            {item.trackingNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{item.carrier || '—'}</IndexTable.Cell>
        <IndexTable.Cell>
          {item.inHistory
            ? <Badge tone={STATUS_TONE_MAP[item.status]}>
              {item.status || 'pending'}
            </Badge>
            : <Badge tone="new">New</Badge>}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{
            maxWidth: '300px',
            wordBreak: 'break-word',
            whiteSpace: 'normal'
          }}>
            <Text variant="bodySm">{item.lastEvent || '—'}</Text>
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>{formatDate(item.lastCheckedAt)}</IndexTable.Cell>
        <IndexTable.Cell>{formatDate(item.orderDate)}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued">
            {item.apiKeyName || '—'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            size="slim"
            onClick={() => handleCheckSingle(item)}
            loading={isCheckingThis}
            disabled={!!checkingId && !isCheckingThis}
          >
            Check
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Orders Check"
      subtitle="Check tracking status from Shopify fulfilled orders"
    >
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

        {/* Progress Card (like Import Product) */}
        {job && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    {job.status === 'completed'
                      ? 'Check Complete'
                      : `Checking: ${currentStore?.storeName || '...'}`}
                  </Text>
                  <Badge tone={
                    job.status === 'completed' ? 'success' : 'attention'
                  }>
                    {progressPercent}%
                  </Badge>
                </InlineStack>

                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e4e5e7',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: '#008060',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <InlineStack gap="400">
                  <Text variant="bodySm" tone="subdued">
                    {job.processedStores}/{job.totalStores} stores
                  </Text>
                  <Text variant="bodySm" tone="success">
                    {job.totalUpdated || 0} updated
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {job.totalRegistered || 0} registered
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="400" blockAlign="end" wrap>
                  <div className="filter-item filter-item--xs">
                    <Select
                      label="Filter by"
                      options={filterOptions}
                      value={filterType}
                      onChange={v => {
                        setFilterType(v);
                        setOrders([]);
                      }}
                      disabled={storesLoading}
                    />
                  </div>
                  {filterType === 'store' && (
                    <div className="filter-item filter-item--lg">
                      <Select
                        label="Store"
                        options={storeOptions}
                        value={selectedStore}
                        onChange={setSelectedStore}
                        disabled={storesLoading}
                      />
                    </div>
                  )}
                  {filterType === 'group' && (
                    <div className="filter-item filter-item--lg">
                      <Select
                        label="Group"
                        options={groupOptions}
                        value={selectedGroup}
                        onChange={setSelectedGroup}
                        disabled={storesLoading}
                      />
                    </div>
                  )}
                  <div className="filter-item filter-item--sm">
                    <Select
                      label="API Key"
                      options={[
                        {label: 'Auto', value: ''},
                        ...apiKeys.map(k => ({
                          label: `${k.name}${k.status !== 'active' ? ` (${k.status})` : ''}`,
                          value: k.id
                        }))
                      ]}
                      value={selectedKeyId}
                      onChange={setSelectedKeyId}
                    />
                  </div>
                  <InlineStack gap="300">
                    <Button
                      onClick={fetchOrders}
                      loading={loading}
                      disabled={!hasValidSelection}
                    >
                      Refresh
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCheckStatus}
                      loading={checking}
                      disabled={!orders.length || !hasValidSelection}
                    >
                      Check Status (17TRACK)
                    </Button>
                    <Button
                      onClick={handleRecheckAll}
                      loading={recheckLoading}
                    >
                      Recheck All
                    </Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>

            {orders.length > 0 && (
              <TextField
                label=""
                placeholder="Search by order # or tracking #"
                value={searchQuery}
                onChange={setSearchQuery}
                clearButton
                onClearButtonClick={() => setSearchQuery('')}
                autoComplete="off"
              />
            )}

            {filteredOrders.length > 0 && (
              <InlineStack gap="400">
                <Badge>Total: {filteredOrders.length}</Badge>
                <Badge tone="new">New: {newCount}</Badge>
                <Badge tone="info">In History: {existingCount}</Badge>
                <Badge tone="success">Delivered: {deliveredCount}</Badge>
              </InlineStack>
            )}

            {loading && !orders.length && <SkeletonBodyText lines={8} />}

            {filteredOrders.length > 0 && (
              <Card padding="0">
                <IndexTable
                  resourceName={{singular: 'order', plural: 'orders'}}
                  itemCount={filteredOrders.length}
                  headings={[
                    {title: 'Order #'},
                    {title: 'Store'},
                    {title: 'Tracking #'},
                    {title: 'Carrier'},
                    {title: 'Status'},
                    {title: 'Last Event'},
                    {title: 'Last Checked'},
                    {title: 'Order Date'},
                    {title: 'API Key'},
                    {title: 'Actions'}
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </Card>
            )}

            {!loading && !hasValidSelection && (
              <Card>
                <Text tone="subdued" alignment="center">
                  Select a store or group to view fulfilled orders
                </Text>
              </Card>
            )}

            {!loading && hasValidSelection && orders.length === 0 && (
              <Card>
                <Text tone="subdued" alignment="center">
                  No fulfilled orders with tracking found
                </Text>
              </Card>
            )}

            {!loading && searchQuery && filteredOrders.length === 0 && orders.length > 0 && (
              <Card>
                <Text tone="subdued" alignment="center">
                  No orders matching "{searchQuery}"
                </Text>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
