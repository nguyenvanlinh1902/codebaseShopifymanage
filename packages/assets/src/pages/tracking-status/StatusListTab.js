import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Select,
  IndexTable,
  Badge,
  SkeletonBodyText
} from '@shopify/polaris';

const STATUS_OPTIONS = [
  {label: 'All statuses', value: ''},
  {label: 'Pending', value: 'pending'},
  {label: 'In Transit', value: 'in_transit'},
  {label: 'Delivered', value: 'delivered'},
  {label: 'Expired', value: 'expired'},
  {label: 'Not Found', value: 'not_found'},
  {label: 'Pick Up', value: 'pick_up'},
  {label: 'Undelivered', value: 'undelivered'},
  {label: 'Alert', value: 'alert'}
];

const LIMIT_OPTIONS = [
  {label: '50', value: '50'},
  {label: '100', value: '100'},
  {label: '500', value: '500'},
  {label: '1000', value: '1000'}
];

const FILTER_TYPE_OPTIONS = [
  {label: 'All Stores', value: 'all'},
  {label: 'Store', value: 'store'},
  {label: 'Group', value: 'group'}
];

const STATUS_TONE_MAP = {
  pending: 'attention',
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

export default function StatusListTab({
  statuses,
  loading,
  statusFilter,
  onFilterChange,
  statusLimit,
  onLimitChange,
  onRefresh,
  onRecheck,
  recheckLoading,
  stores = [],
  groups = [],
  filterType,
  onFilterTypeChange,
  selectedStore,
  onStoreChange,
  selectedGroup,
  onGroupChange
}) {
  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain || s.id, value: s.id}));
  const groupOptions = groups.map(g => ({label: g.name, value: g.id}));

  // Build store name lookup (prefer name over shopDomain)
  const storeMap = {};
  stores.forEach(s => { storeMap[s.id] = s.name || s.shopDomain || s.id; });

  const hasSelection = filterType === 'all' || (filterType === 'store' && selectedStore) || (filterType === 'group' && selectedGroup);

  if (loading && !statuses.length) {
    return (
      <Box padding="400">
        <SkeletonBodyText lines={8} />
      </Box>
    );
  }

  const resourceName = {singular: 'tracking', plural: 'trackings'};

  const rowMarkup = statuses.map((item, index) => (
    <IndexTable.Row id={item.id || item.trackingNumber} key={item.id || item.trackingNumber} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">{item.trackingNumber}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{item.orderNumber || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm">{storeMap[item.storeId] || item.storeId || '—'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{item.carrier || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE_MAP[item.status]}>{item.status || 'unknown'}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal'}}>
          <Text variant="bodySm">{item.lastEvent || '—'}</Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(item.lastCheckedAt)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">{item.apiKeyName || '—'}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Box padding="400">
      <BlockStack gap="400">
        {/* Store/Group Filter */}
        <Card>
          <InlineStack gap="300" blockAlign="end" wrap={false}>
            <div style={{minWidth: '100px'}}>
              <Select
                label="Filter by"
                options={FILTER_TYPE_OPTIONS}
                value={filterType}
                onChange={(v) => { onFilterTypeChange(v); onStoreChange(''); onGroupChange(''); }}
              />
            </div>
            {filterType === 'store' && (
              <div style={{minWidth: '200px'}}>
                <Select
                  label="Store"
                  options={[{label: '-- Select Store --', value: ''}, ...storeOptions]}
                  value={selectedStore}
                  onChange={onStoreChange}
                />
              </div>
            )}
            {filterType === 'group' && (
              <div style={{minWidth: '200px'}}>
                <Select
                  label="Group"
                  options={[{label: '-- Select Group --', value: ''}, ...groupOptions]}
                  value={selectedGroup}
                  onChange={onGroupChange}
                />
              </div>
            )}
            <div style={{minWidth: '140px'}}>
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={onFilterChange}
              />
            </div>
            <div style={{minWidth: '80px'}}>
              <Select
                label="Limit"
                options={LIMIT_OPTIONS}
                value={statusLimit}
                onChange={onLimitChange}
              />
            </div>
            <Button onClick={onRefresh} disabled={loading || !hasSelection}>Refresh</Button>
            {onRecheck && (
              <Button variant="primary" onClick={onRecheck} loading={recheckLoading} disabled={!hasSelection}>
                Recheck All
              </Button>
            )}
          </InlineStack>
        </Card>

        {!hasSelection && (
          <Card>
            <Text tone="subdued">Select a Store or Group to view tracking history.</Text>
          </Card>
        )}

        {/* Table */}
        {hasSelection && (
          <>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={statuses.length}
                headings={[
                  {title: 'Tracking #'},
                  {title: 'Order'},
                  {title: 'Store'},
                  {title: 'Carrier'},
                  {title: 'Status'},
                  {title: 'Last Event'},
                  {title: 'Last Checked'},
                  {title: 'API Key'}
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>

            <Text variant="bodySm" tone="subdued" alignment="end">
              Showing {statuses.length} tracking(s)
            </Text>
          </>
        )}
      </BlockStack>
    </Box>
  );
}
