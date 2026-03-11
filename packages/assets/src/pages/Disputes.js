import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  SkeletonBodyText,
  BlockStack,
  Icon,
  Select,
  InlineStack,
  TextField
} from '@shopify/polaris';
import {AlertDiamondIcon, DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
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
  const {stores, user} = usePermittedStores();
  const timezone = user?.timezone || '';
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const storeOptions = [
    ...(stores.length > 1
      ? [{label: `All stores (${stores.length})`, value: ALL_STORES_VALUE}]
      : []),
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  // Auto-select when stores list changes
  useEffect(() => {
    if (stores.length > 1) {
      setSelectedStoreId(ALL_STORES_VALUE);
    } else if (stores.length === 1) {
      setSelectedStoreId(stores[0].id);
    } else {
      setSelectedStoreId('');
    }
  }, [stores]);

  const fetchDisputes = useCallback(
    async storeId => {
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
    },
    [statusFilter]
  );

  // Fetch when store selection changes
  useEffect(() => {
    if (!selectedStoreId || stores.length === 0) return;
    fetchDisputes(selectedStoreId);
  }, [selectedStoreId, statusFilter, fetchDisputes, stores.length]);

  // Filter by date (client-side)
  const filtered = useMemo(() => {
    let result = disputes;
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(d => d.initiatedAt && new Date(d.initiatedAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(d => d.initiatedAt && new Date(d.initiatedAt) <= to);
    }
    return result;
  }, [disputes, dateFrom, dateTo]);

  const resourceName = {singular: 'dispute', plural: 'disputes'};

  const rowMarkup = filtered.map((d, idx) => (
    <IndexTable.Row id={`${d.disputeId}-${idx}`} key={`${d.disputeId}-${idx}`} position={idx}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">
          {d.store}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{d.orderName}</IndexTable.Cell>
      <IndexTable.Cell>
        {d.email
          ? d.email
          : d.orderDeleted
          ? <InlineStack gap="100" blockAlign="center"><Icon source={DeleteIcon} tone="subdued" /><Text tone="subdued">Order deleted</Text></InlineStack>
          : '—'}
      </IndexTable.Cell>
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
    </IndexTable.Row>
  ));

  return (
    <Page title="Disputes" subtitle="Shopify Payments disputes across all stores">
      <Layout>
        <Layout.Section>
          <Card>
            <InlineStack align="start" gap="400" wrap>
              <div style={{minWidth: 240}}>
                <Select
                  label="Store"
                  options={storeOptions}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                />
              </div>
              <div style={{minWidth: 160}}>
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>
              <div style={{minWidth: 140}}>
                <TextField
                  label="From"
                  type="date"
                  value={dateFrom}
                  onChange={setDateFrom}
                  autoComplete="off"
                />
              </div>
              <div style={{minWidth: 140}}>
                <TextField
                  label="To"
                  type="date"
                  value={dateTo}
                  onChange={setDateTo}
                  autoComplete="off"
                />
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <SkeletonBodyText lines={8} />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <BlockStack align="center" inlineAlign="center" gap="200">
                <div style={{padding: '32px 0 4px'}}>
                  <Icon source={AlertDiamondIcon} tone="subdued" />
                </div>
                <Text variant="headingSm" as="p">
                  No disputes found
                </Text>
                <Text variant="bodySm" tone="subdued">
                  No Shopify Payments disputes for the selected filters.
                </Text>
                <div style={{paddingBottom: 24}} />
              </BlockStack>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={filtered.length}
                headings={[
                  {title: 'Store'},
                  {title: 'Order'},
                  {title: 'Email'},
                  {title: 'Status'},
                  {title: 'Reason'},
                  {title: 'Amount'},
                  {title: 'Initiated'},
                  {title: 'Evidence Due'}
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
