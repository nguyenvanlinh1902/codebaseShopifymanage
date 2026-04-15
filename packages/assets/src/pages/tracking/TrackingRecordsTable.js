import React from 'react';
import {Card, Text, Badge, Box, BlockStack, SkeletonBodyText} from '@shopify/polaris';
import PaginationControls from '../../components/pagination-controls';

const STATUS_BADGE = {
  true: {tone: 'success', label: 'Success'},
  false: {tone: 'critical', label: 'Failed'}
};

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
    + ' ' + d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
}

const TH = {padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e1e3e5', fontWeight: 600, fontSize: 13};
const TD = {padding: '10px 12px', borderBottom: '1px solid #e1e3e5', fontSize: 13};

export default function TrackingRecordsTable({
  records,
  loading,
  pagination,
  page,
  perPage,
  search,
  onPageChange,
  onPerPageChange,
  onSearchChange
}) {
  const totalItems = pagination?.total ?? records.length;

  if (loading) {
    return (
      <Card>
        <Box padding="400">
          <SkeletonBodyText lines={10} />
        </Box>
      </Card>
    );
  }

  return (
    <Card padding="0">
      <Box padding="400">
        <Text as="h2" variant="headingMd">
          Order Tracking Updates
          {totalItems > 0 && (
            <span style={{fontWeight: 400, fontSize: 13, color: '#6d7175', marginLeft: 8}}>
              {totalItems} record{totalItems !== 1 ? 's' : ''}
            </span>
          )}
        </Text>
      </Box>

      {totalItems === 0 && !search ? (
        <Box padding="1000">
          <Text tone="subdued" alignment="center" variant="bodySm">
            No tracking records yet — import tracking data to see results here
          </Text>
        </Box>
      ) : (
        <>
          <Box paddingInlineStart="400" paddingInlineEnd="400" paddingBlockEnd="300">
            <PaginationControls
              page={page}
              totalPages={pagination?.totalPages || 1}
              totalItems={totalItems}
              perPage={perPage}
              onPageChange={onPageChange}
              onPerPageChange={onPerPageChange}
              search={search}
              onSearchChange={onSearchChange}
              searchPlaceholder="Search by order, tracking #, carrier, or store..."
            />
          </Box>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead style={{background: '#f6f6f7'}}>
                <tr>
                  <th style={TH}>Order #</th>
                  <th style={TH}>Tracking Number</th>
                  <th style={TH}>Carrier</th>
                  <th style={TH}>Store</th>
                  <th style={{...TH, textAlign: 'center'}}>Status</th>
                  <th style={TH}>Source</th>
                  <th style={TH}>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const badge = STATUS_BADGE[String(r.success)] || STATUS_BADGE['false'];
                  return (
                    <tr key={i} style={{background: i % 2 === 0 ? '#fff' : '#fafbfb'}}>
                      <td style={TD}><strong>{r.orderNumber}</strong></td>
                      <td style={{...TD, fontFamily: 'monospace'}}>{r.trackingNumber}</td>
                      <td style={TD}>{r.carrier || '-'}</td>
                      <td style={TD}>
                        <Text variant="bodySm">{r.storeName || '-'}</Text>
                      </td>
                      <td style={{...TD, textAlign: 'center'}}>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td style={TD}>
                        <Text variant="bodySm" tone="subdued">{r.source || '-'}</Text>
                      </td>
                      <td style={TD}>
                        <Text variant="bodySm" tone="subdued">{fmtDate(r.updatedAt)}</Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
