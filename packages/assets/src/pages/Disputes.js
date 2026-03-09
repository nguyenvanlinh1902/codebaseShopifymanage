import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  Link,
  SkeletonBodyText,
  EmptyState,
  Select,
  InlineStack,
  Banner
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';
import {formatDate, formatDateTime} from '../helpers/format-date';

const STATUS_TONES = {
  needs_response: 'critical',
  under_review: 'attention',
  won: 'success',
  lost: 'new',
  accepted: 'info',
  charge_refunded: 'info'
};

const STATUS_OPTIONS = [
  {label: 'All statuses', value: ''},
  {label: 'Needs Response', value: 'needs_response'},
  {label: 'Under Review', value: 'under_review'},
  {label: 'Won', value: 'won'},
  {label: 'Lost', value: 'lost'},
  {label: 'Accepted', value: 'accepted'},
  {label: 'Charge Refunded', value: 'charge_refunded'}
];

function statusLabel(status) {
  return (status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const ALL_STORES_VALUE = '__all__';

export default function Disputes() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {stores: allStores, groups} = useStores();
  const stores = isAdmin
    ? allStores
    : allStores.filter(s => (user?.assignedStores || []).includes(s.id));

  const timezone = user?.timezone || '';
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const visibleStores = useMemo(
    () => (groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores),
    [groupFilter, stores]
  );

  const storeOptions = [
    ...(visibleStores.length > 1
      ? [{label: `All stores (${visibleStores.length})`, value: ALL_STORES_VALUE}]
      : []),
    ...visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const groupOptions = [
    {label: 'All groups', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];

  // Auto-select when group or stores list changes
  useEffect(() => {
    if (visibleStores.length > 1) {
      setSelectedStoreId(ALL_STORES_VALUE);
    } else if (visibleStores.length === 1) {
      setSelectedStoreId(visibleStores[0].id);
    } else {
      setSelectedStoreId('');
    }
  }, [visibleStores]);

  const fetchDisputes = useCallback(async storeId => {
    setLoading(true);
    setDisputes([]);
    try {
      const query = new URLSearchParams();
      if (storeId && storeId !== ALL_STORES_VALUE) query.set('storeId', storeId);
      if (statusFilter) query.set('status', statusFilter);
      const qs = query.toString();
      const res = await api(`/api/analytics/disputes${qs ? `?${qs}` : ''}`);
      const result = await res.json();
      if (result.success) {
        setDisputes(result.data || []);
      }
    } catch (err) {
      console.error('[Disputes] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch when store selection changes
  useEffect(() => {
    if (!selectedStoreId || visibleStores.length === 0) return;
    fetchDisputes(selectedStoreId);
  }, [selectedStoreId, statusFilter, fetchDisputes, visibleStores.length]);

  // Filter by group (client-side, since API returns all or single store)
  const filtered = useMemo(() => {
    if (!groupFilter || selectedStoreId !== ALL_STORES_VALUE) return disputes;
    const idsInGroup = visibleStores.map(s => s.id);
    return disputes.filter(d => idsInGroup.includes(d.storeId));
  }, [disputes, groupFilter, selectedStoreId, visibleStores]);

  const resourceName = {singular: 'dispute', plural: 'disputes'};

  const rowMarkup = filtered.map((d, idx) => (
    <IndexTable.Row id={`${d.disputeId}-${idx}`} key={`${d.disputeId}-${idx}`} position={idx}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">{d.store}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{d.orderName}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONES[d.status] || 'new'}>{statusLabel(d.status)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{d.reason}</IndexTable.Cell>
      <IndexTable.Cell>
        {d.currency} {d.amount}
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDateTime(d.initiatedAt, timezone)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text tone={d.evidenceDueBy ? 'critical' : 'subdued'}>
          {d.evidenceDueBy ? formatDate(d.evidenceDueBy, timezone) : 'N/A'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {d.adminUrl && <Link url={d.adminUrl} external>View in Shopify</Link>}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Disputes" subtitle="Shopify Payments disputes across all stores">
      <Layout>
        <Layout.Section>
          <InlineStack align="start" gap="400">
            {groups.length > 0 && (
              <div style={{minWidth: 200}}>
                <Select label="Group" options={groupOptions} value={groupFilter} onChange={setGroupFilter} />
              </div>
            )}
            <div style={{minWidth: 280}}>
              <Select label="Store" options={storeOptions} value={selectedStoreId} onChange={setSelectedStoreId} />
            </div>
            <div style={{minWidth: 180}}>
              <Select label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            </div>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card><SkeletonBodyText lines={8} /></Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState heading="No disputes found" image="">
                <Banner tone="info">
                  <p>No Shopify Payments disputes for the selected store. This is a good sign!</p>
                </Banner>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={filtered.length}
                headings={[
                  {title: 'Store'},
                  {title: 'Order'},
                  {title: 'Status'},
                  {title: 'Reason'},
                  {title: 'Amount'},
                  {title: 'Initiated'},
                  {title: 'Evidence Due'},
                  {title: 'Action'}
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
