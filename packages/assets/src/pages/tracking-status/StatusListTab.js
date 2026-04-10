import React from 'react';
import {
  Card,
  BlockStack,
  Text,
  Button,
  Box,
  IndexTable,
  Badge,
  SkeletonBodyText,
  Tabs
} from '@shopify/polaris';
import PaginationControls from '../../components/pagination-controls';

const STATUS_TABS = [
  {id: '', content: 'All'},
  {id: 'pending', content: 'Pending'},
  {id: 'info_received', content: 'Info Received'},
  {id: 'in_transit', content: 'In Transit'},
  {id: 'delivered', content: 'Delivered'},
  {id: 'expired', content: 'Expired'},
  {id: 'not_found', content: 'Not Found'},
  {id: 'alert', content: 'Alert'},
  {id: '__stale__', content: 'Stale (7d+)'}
];

const FINAL_STATUSES = ['delivered', 'expired'];

function getDaysStale(lastEventDate, createdAt) {
  const ref = lastEventDate || createdAt;
  if (!ref) return null;
  return Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
}

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

export default function StatusListTab({
  statuses,
  loading,
  statusFilter,
  onFilterChange,
  pagination,
  page,
  perPage,
  search,
  onPageChange,
  onPerPageChange,
  onSearchChange,
  onHide,
  onRemove
}) {
  const selectedTabIndex = STATUS_TABS.findIndex(t => t.id === statusFilter);

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
      <IndexTable.Cell>{formatDate(item.firstEventDate || item.createdAt)}</IndexTable.Cell>
      <IndexTable.Cell>{item.orderNumber || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">{item.trackingNumber}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE_MAP[item.status]}>{item.status || 'unknown'}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {FINAL_STATUSES.includes(item.status) ? (
          <Text variant="bodySm" tone="subdued">—</Text>
        ) : (() => {
          const days = getDaysStale(item.lastEventDate, item.firstEventDate || item.createdAt);
          if (days === null) return <Text variant="bodySm" tone="subdued">—</Text>;
          return <Badge tone={days > 7 ? 'critical' : 'success'}>{days}d</Badge>;
        })()}
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(item.lastEventDate || item.lastCheckedAt)}</IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal'}}>
          <Text variant="bodySm">{item.lastEvent || '—'}</Text>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">{item.apiKeyName || '—'}</Text>
      </IndexTable.Cell>
      {(onHide || onRemove) && (
        <IndexTable.Cell>
          {onHide && (
            <Button
              size="slim"
              tone="critical"
              variant="plain"
              onClick={() => onHide(item.id || item.trackingNumber)}
            >
              Hide
            </Button>
          )}
          {onRemove && (
            <Button
              size="slim"
              tone="critical"
              variant="plain"
              onClick={() => onRemove(item.id || item.trackingNumber)}
            >
              Remove
            </Button>
          )}
        </IndexTable.Cell>
      )}
    </IndexTable.Row>
  ));

  return (
    <Box>
      <BlockStack gap="400">
        {/* Status Tabs */}
        <Tabs
          tabs={STATUS_TABS}
          selected={selectedTabIndex >= 0 ? selectedTabIndex : 0}
          onSelect={i => onFilterChange(STATUS_TABS[i].id)}
          fitted
        />

        {/* Table */}
        <PaginationControls
          page={page}
          totalPages={pagination?.totalPages || 1}
          totalItems={pagination?.total || 0}
          perPage={perPage}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search tracking number, order, note..."
        />
        <Card padding="0">
          <IndexTable
            resourceName={resourceName}
            itemCount={statuses.length}
            headings={[
              {title: 'Shipment Date'},
              {title: 'Order number'},
              {title: 'Tracking number'},
              {title: 'Status'},
              {title: 'Days Stale'},
              {title: 'Last updated date'},
              {title: 'Note'},
              {title: 'API Key'},
              ...(onHide || onRemove ? [{title: 'Actions'}] : [])
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>
    </Box>
  );
}
