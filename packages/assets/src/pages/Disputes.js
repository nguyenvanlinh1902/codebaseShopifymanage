import React, {useState, useEffect, useRef} from 'react';
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
  InlineStack
} from '@shopify/polaris';
import {AlertDiamondIcon, DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import {formatDate, formatDateTime} from '../helpers/format-date';
import PaginationControls from '../components/pagination-controls';
import StoreSelector from '../components/store-selector';
import DateRangePopover from '../components/date-range-popover';

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
  const [evidenceDueFrom, setEvidenceDueFrom] = useState('');
  const [evidenceDueTo, setEvidenceDueTo] = useState('');
  const [pagination, setPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');

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

  const fetchDisputes = async () => {
    if (!selectedStoreId || stores.length === 0) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({page, perPage, search});
      if (selectedStoreId && selectedStoreId !== ALL_STORES_VALUE)
        query.set('storeId', selectedStoreId);
      if (statusFilter) query.set('status', statusFilter);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (evidenceDueFrom) query.set('evidenceDueFrom', evidenceDueFrom);
      if (evidenceDueTo) query.set('evidenceDueTo', evidenceDueTo);
      const res = await api(`/api/analytics/disputes?${query}`);
      const result = await res.json();
      if (result.success) {
        setDisputes(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch (err) {
      console.error('[Disputes] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Single effect: fetch + auto-reset page when filters change
  const filtersRef = useRef({
    selectedStoreId,
    statusFilter,
    dateFrom,
    dateTo,
    evidenceDueFrom,
    evidenceDueTo,
    perPage,
    search
  });
  useEffect(() => {
    const prev = filtersRef.current;
    const filtersChanged =
      prev.selectedStoreId !== selectedStoreId ||
      prev.statusFilter !== statusFilter ||
      prev.dateFrom !== dateFrom ||
      prev.dateTo !== dateTo ||
      prev.evidenceDueFrom !== evidenceDueFrom ||
      prev.evidenceDueTo !== evidenceDueTo ||
      prev.perPage !== perPage ||
      prev.search !== search;
    filtersRef.current = {
      selectedStoreId,
      statusFilter,
      dateFrom,
      dateTo,
      evidenceDueFrom,
      evidenceDueTo,
      perPage,
      search
    };

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }
    fetchDisputes();
  }, [
    page,
    perPage,
    search,
    selectedStoreId,
    statusFilter,
    dateFrom,
    dateTo,
    evidenceDueFrom,
    evidenceDueTo,
    stores.length
  ]);

  const resourceName = {singular: 'dispute', plural: 'disputes'};

  const rowMarkup = disputes.map((d, idx) => (
    <IndexTable.Row id={`${d.disputeId}-${idx}`} key={`${d.disputeId}-${idx}`} position={idx}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">
          {d.store}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{d.orderName}</IndexTable.Cell>
      <IndexTable.Cell>
        {d.email ? (
          d.email
        ) : d.orderDeleted ? (
          <InlineStack gap="100" blockAlign="center">
            <Icon source={DeleteIcon} tone="subdued" />
            <Text tone="subdued">Order deleted</Text>
          </InlineStack>
        ) : (
          '—'
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>{d.phone || (d.orderDeleted ? '' : '—')}</IndexTable.Cell>
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
            <InlineStack align="start" blockAlign="end" gap="400" wrap>
              <div className="filter-item filter-item--lg">
                <StoreSelector
                  label="Store"
                  options={storeOptions}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                  pinnedValues={[ALL_STORES_VALUE]}
                />
              </div>
              <div className="filter-item filter-item--sm">
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>
              <DateRangePopover
                label="Initiated date"
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
              <DateRangePopover
                label="Evidence due"
                from={evidenceDueFrom}
                to={evidenceDueTo}
                onFromChange={setEvidenceDueFrom}
                onToChange={setEvidenceDueTo}
              />
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <SkeletonBodyText lines={8} />
            </Card>
          ) : disputes.length === 0 && !search ? (
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
                itemCount={disputes.length}
                headings={[
                  {title: 'Store'},
                  {title: 'Order'},
                  {title: 'Email'},
                  {title: 'Phone'},
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
              <PaginationControls
                page={page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search order, email, reason..."
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
