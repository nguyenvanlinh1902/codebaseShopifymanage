import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
  Text,
  Badge,
  Toast,
  IndexTable,
  useIndexResourceState,
  InlineStack,
  Box,
  EmptyState,
  SkeletonBodyText,
  Pagination
} from '@shopify/polaris';
import {PlusIcon, ExternalIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const STATUS_TONE = {OPEN: 'info', INVOICE_SENT: 'attention', COMPLETED: 'success'};

export default function DraftOrderList({storeId, storeOptions, onStoreChange, onCreate, onEdit}) {
  const [draftOrders, setDraftOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({hasNextPage: false, endCursor: null});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Cursor stack: cursors[i] = cursor used to fetch page i (null = first page).
  const [cursors, setCursors] = useState([null]);
  const [pageIdx, setPageIdx] = useState(0);

  const resourceIDResolver = useCallback(d => d.id, []);
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(draftOrders, {resourceIDResolver});

  const fetchPage = async cursor => {
    setLoading(true);
    try {
      const params = new URLSearchParams({storeId});
      if (cursor) params.set('cursor', cursor);
      const res = await api(`/api/draft-orders?${params}`);
      const result = await res.json();
      if (result.success) {
        setDraftOrders(result.data.draftOrders);
        setPageInfo(result.data.pageInfo || {hasNextPage: false, endCursor: null});
      }
    } catch (err) {
      console.warn('Fetch draft orders failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetAndFetch = () => {
    setCursors([null]);
    setPageIdx(0);
    clearSelection();
    fetchPage(null);
  };

  useEffect(() => {
    if (storeId) resetAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const handleNext = async () => {
    const nextCursor = pageInfo.endCursor;
    if (!nextCursor) return;
    await fetchPage(nextCursor);
    setCursors(prev => (pageIdx + 1 < prev.length ? prev : [...prev, nextCursor]));
    setPageIdx(pageIdx + 1);
    clearSelection();
  };

  const handlePrev = async () => {
    if (pageIdx === 0) return;
    const prevCursor = cursors[pageIdx - 1];
    await fetchPage(prevCursor);
    setPageIdx(pageIdx - 1);
    clearSelection();
  };

  const callApi = async (path, label, ids) => {
    if (!ids || ids.length === 0) return;
    setSubmitting(true);
    try {
      const res = await api(path, {
        method: 'POST',
        body: JSON.stringify({storeId, sourceIds: ids})
      });
      const result = await res.json();
      if (!result.success) {
        setToast({message: result.error || `${label} failed`, error: true});
        return;
      }
      const {succeeded, failed, errors} = result.data;
      const errSummary =
        failed > 0
          ? ` — ${errors
              .slice(0, 2)
              .map(e => `#${e.sourceId} (${e.message})`)
              .join('; ')}${errors.length > 2 ? ` +${errors.length - 2} more` : ''}`
          : '';
      setToast({
        message: `${label}: ${succeeded} succeeded, ${failed} failed${errSummary}`,
        error: failed > 0
      });
      clearSelection();
      await fetchPage(cursors[pageIdx]);
    } catch (err) {
      setToast({message: err.message || `${label} failed`, error: true});
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = () => callApi('/api/draft-orders/bulk-duplicate', 'Duplicate', selectedResources);
  const handleMarkAsPaid = () => callApi('/api/draft-orders/bulk-complete', 'Mark as paid', selectedResources);
  const handleRowDuplicate = id => callApi('/api/draft-orders/bulk-duplicate', 'Duplicate', [id]);
  const handleRowMarkAsPaid = id => callApi('/api/draft-orders/bulk-complete', 'Mark as paid', [id]);

  const selected = draftOrders.filter(d => selectedResources.includes(d.id));
  const canMarkAsPaid = selected.length > 0 && selected.every(d => d.status === 'OPEN');

  const bulkActions = [
    {content: 'Duplicate', onAction: handleDuplicate, disabled: submitting},
    ...(canMarkAsPaid
      ? [{content: 'Mark as paid', onAction: handleMarkAsPaid, disabled: submitting}]
      : [])
  ];

  const rowMarkup = draftOrders.map((d, index) => {
    const numericId = d.id.split('/').pop();
    return (
      <IndexTable.Row
        id={d.id}
        key={d.id}
        selected={selectedResources.includes(d.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {d.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{new Date(d.createdAt).toLocaleDateString()}</IndexTable.Cell>
        <IndexTable.Cell>{d.customer?.name || 'No customer'}</IndexTable.Cell>
        <IndexTable.Cell>
          {d.currency} {parseFloat(d.total).toFixed(2)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_TONE[d.status] || 'new'}>{d.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200" wrap={false}>
            <Button size="slim" onClick={() => onEdit(numericId)}>
              Edit
            </Button>
            <Button size="slim" icon={ExternalIcon} url={d.adminUrl} external>
              View
            </Button>
            <Button
              size="slim"
              onClick={() => handleRowDuplicate(d.id)}
              disabled={submitting}
            >
              Duplicate
            </Button>
            {d.status === 'OPEN' && (
              <Button
                size="slim"
                variant="primary"
                onClick={() => handleRowMarkAsPaid(d.id)}
                disabled={submitting}
              >
                Mark as paid
              </Button>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const hasPrev = pageIdx > 0;
  const hasNext = pageInfo.hasNextPage;

  return (
    <Page
      title="Draft Orders"
      primaryAction={{
        content: 'Create order',
        icon: PlusIcon,
        onAction: onCreate,
        disabled: !storeId
      }}
    >
      <Layout>
        <Layout.Section>
          <Select
            label="Store"
            options={storeOptions}
            value={storeId}
            onChange={v => {
              onStoreChange(v);
              setDraftOrders([]);
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <Card padding="0">
            {loading ? (
              <Box padding="400">
                <SkeletonBodyText lines={8} />
              </Box>
            ) : draftOrders.length > 0 ? (
              <>
                <IndexTable
                  resourceName={{singular: 'draft order', plural: 'draft orders'}}
                  itemCount={draftOrders.length}
                  selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  bulkActions={bulkActions}
                  headings={[
                    {title: 'Order'},
                    {title: 'Date'},
                    {title: 'Customer'},
                    {title: 'Total'},
                    {title: 'Status'},
                    {title: ''}
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
                {(hasPrev || hasNext) && (
                  <Box padding="300" borderBlockStartWidth="025" borderColor="border">
                    <InlineStack align="center">
                      <Pagination
                        hasPrevious={hasPrev}
                        onPrevious={handlePrev}
                        hasNext={hasNext}
                        onNext={handleNext}
                        label={`Page ${pageIdx + 1}`}
                      />
                    </InlineStack>
                  </Box>
                )}
              </>
            ) : (
              <EmptyState heading="Create a draft order" image="">
                <p>Draft orders let you create orders on behalf of your customers.</p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
      {toast && (
        <Toast
          content={toast.message}
          error={toast.error}
          onDismiss={() => setToast(null)}
          duration={6000}
        />
      )}
    </Page>
  );
}
