import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  Page,
  Layout,
  Card,
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
  Pagination,
  Modal,
  TextField,
  Autocomplete,
  ChoiceList,
  Banner,
  Icon
} from '@shopify/polaris';
import {PlusIcon, ExternalIcon, SearchIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const STATUS_TONE = {OPEN: 'info', INVOICE_SENT: 'attention', COMPLETED: 'success'};
const MAX_DUPLICATE_COPIES = 15;

export default function DraftOrderList({storeId, storeOptions, onStoreChange, onCreate, onEdit}) {
  const [draftOrders, setDraftOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({hasNextPage: false, endCursor: null});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [dupModal, setDupModal] = useState({
    open: false,
    id: null,
    count: '1',
    targetStoreIds: []
  });

  // Searchable single-select store picker (Autocomplete)
  const [storeSearch, setStoreSearch] = useState('');
  const filteredStoreOptions = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return storeOptions;
    return storeOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [storeSearch, storeOptions]);

  const storeIdToLabel = useMemo(
    () => Object.fromEntries(storeOptions.map(o => [o.value, o.label])),
    [storeOptions]
  );

  // Keep search input synced with active store label when not searching.
  useEffect(() => {
    if (storeId && !storeSearch) setStoreSearch(storeIdToLabel[storeId] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, storeIdToLabel]);

  // Cursor stack: cursors[i] = cursor used to fetch page i (null = first page).
  const [cursors, setCursors] = useState([null]);
  const [pageIdx, setPageIdx] = useState(0);

  const resourceIDResolver = useCallback(d => d.id, []);
  const {selectedResources, allResourcesSelected, handleSelectionChange, clearSelection} =
    useIndexResourceState(draftOrders, {resourceIDResolver});

  const fetchPage = async cursor => {
    if (!storeId) return;
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

  const handleDuplicate = () =>
    callApi('/api/draft-orders/bulk-duplicate', 'Duplicate', selectedResources);
  const handleMarkAsPaid = () =>
    callApi('/api/draft-orders/bulk-complete', 'Mark as paid', selectedResources);
  const handleRowDuplicate = id =>
    setDupModal({open: true, id, count: '1', targetStoreIds: [storeId]});
  const handleRowMarkAsPaid = id =>
    callApi('/api/draft-orders/bulk-complete', 'Mark as paid', [id]);

  const closeDupModal = () =>
    setDupModal({open: false, id: null, count: '1', targetStoreIds: []});

  // Fan out N copies of source draft to each selected target store in parallel.
  // Cross-store targets strip variantId/customerId server-side.
  const confirmDuplicate = async () => {
    const n = Math.max(1, Math.min(MAX_DUPLICATE_COPIES, parseInt(dupModal.count, 10) || 1));
    const targets = dupModal.targetStoreIds.length > 0 ? dupModal.targetStoreIds : [storeId];
    const ids = Array(n).fill(dupModal.id);
    closeDupModal();
    setSubmitting(true);
    try {
      const responses = await Promise.all(
        targets.map(async tid => {
          try {
            const res = await api('/api/draft-orders/bulk-duplicate', {
              method: 'POST',
              body: JSON.stringify({storeId: tid, sourceIds: ids, sourceStoreId: storeId})
            });
            return {tid, json: await res.json()};
          } catch (err) {
            return {tid, json: {success: false, error: err.message || 'failed'}};
          }
        })
      );
      let succeeded = 0;
      let failed = 0;
      const errLines = [];
      responses.forEach(({tid, json}) => {
        const tname = storeIdToLabel[tid] || tid;
        if (json.success) {
          succeeded += json.data.succeeded;
          failed += json.data.failed;
          (json.data.errors || []).forEach(e =>
            errLines.push(`${tname} #${e.sourceId} (${e.message})`)
          );
        } else {
          failed += 1;
          errLines.push(`${tname}: ${json.error || 'failed'}`);
        }
      });
      const errSummary =
        failed > 0
          ? ` — ${errLines.slice(0, 2).join('; ')}${
              errLines.length > 2 ? ` +${errLines.length - 2} more` : ''
            }`
          : '';
      setToast({
        message: `Duplicate ×${n} → ${targets.length} store${
          targets.length > 1 ? 's' : ''
        }: ${succeeded} succeeded, ${failed} failed${errSummary}`,
        error: failed > 0
      });
      clearSelection();
      await fetchPage(cursors[pageIdx]);
    } catch (err) {
      setToast({message: err.message || 'Duplicate failed', error: true});
    } finally {
      setSubmitting(false);
    }
  };

  const selected = draftOrders.filter(d => selectedResources.includes(d.id));
  const canMarkAsPaid = selected.length > 0 && selected.every(d => d.status === 'OPEN');

  const bulkActions = [
    {content: 'Duplicate', onAction: handleDuplicate, disabled: submitting},
    ...(canMarkAsPaid
      ? [{content: 'Mark as paid', onAction: handleMarkAsPaid, disabled: submitting}]
      : [])
  ];

  // Cross-store warning: any selected target != current source store
  const dupHasCrossStore =
    dupModal.targetStoreIds.some(t => t !== storeId);

  const handleStoreSearchChange = value => {
    setStoreSearch(value);
  };

  const handleStoreSelect = selectedArr => {
    const v = selectedArr[0];
    if (!v) return;
    const matched = storeOptions.find(o => o.value === v);
    setStoreSearch(matched?.label || '');
    onStoreChange(v);
  };

  const rowMarkup = draftOrders.map((d, index) => {
    const numericId = d.id.split('/').pop();
    return (
      <IndexTable.Row id={d.id} key={d.id} selected={selectedResources.includes(d.id)} position={index}>
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
            <Button size="slim" onClick={() => handleRowDuplicate(d.id)} disabled={submitting}>
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

  const storeTextField = (
    <Autocomplete.TextField
      label="Store"
      labelHidden
      value={storeSearch}
      onChange={handleStoreSearchChange}
      onFocus={() => setStoreSearch('')}
      prefix={<Icon source={SearchIcon} />}
      placeholder="Search store"
      autoComplete="off"
    />
  );

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
          <Box maxWidth="320px">
            <Autocomplete
              options={filteredStoreOptions}
              selected={storeId ? [storeId] : []}
              onSelect={handleStoreSelect}
              textField={storeTextField}
            />
          </Box>
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
      {dupModal.open && (
        <Modal
          open={dupModal.open}
          onClose={closeDupModal}
          title="Duplicate draft order"
          primaryAction={{
            content: 'Duplicate',
            onAction: confirmDuplicate,
            loading: submitting,
            disabled: dupModal.targetStoreIds.length === 0
          }}
          secondaryActions={[{content: 'Cancel', onAction: closeDupModal}]}
        >
          <Modal.Section>
            <Box paddingBlockEnd="300">
              <Text as="p" tone="subdued" variant="bodySm">
                {`Source store: ${storeIdToLabel[storeId] || '—'}`}
              </Text>
            </Box>
            <ChoiceList
              allowMultiple
              title="Duplicate to stores"
              choices={storeOptions.map(o => ({label: o.label, value: o.value}))}
              selected={dupModal.targetStoreIds}
              onChange={v => setDupModal(s => ({...s, targetStoreIds: v}))}
            />
            {dupHasCrossStore && (
              <Box paddingBlockStart="300">
                <Banner tone="warning" title="Cross-store duplicate">
                  <p>
                    Customer and product variant links won&apos;t carry over (different shop). Line
                    items become custom (title + price), customer is dropped. Addresses, tags,
                    note, discount, shipping line are preserved.
                  </p>
                </Banner>
              </Box>
            )}
            <Box paddingBlockStart="300">
              <TextField
                label={`Number of copies per store (max ${MAX_DUPLICATE_COPIES})`}
                type="number"
                min={1}
                max={MAX_DUPLICATE_COPIES}
                value={dupModal.count}
                onChange={v => setDupModal(s => ({...s, count: v}))}
                autoComplete="off"
              />
            </Box>
          </Modal.Section>
        </Modal>
      )}
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
