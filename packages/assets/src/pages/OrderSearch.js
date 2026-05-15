import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  Page,
  Layout,
  Select,
  TextField,
  Card,
  DataTable,
  Badge,
  Button,
  Text,
  SkeletonBodyText,
  EmptyState,
  InlineStack,
  Toast,
  Frame
} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import StoreSelector from '../components/store-selector';

import {FULFILLMENT_TONE, FINANCIAL_TONE} from '../helpers/order-status-tones';

// Extract numeric id from Shopify GID
const numericOrderId = gid => String(gid || '').split('/').pop();

export default function OrderSearch() {
  const navigate = useNavigate();
  const {stores} = usePermittedStores();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({hasNextPage: false, endCursor: null});
  const [loadingMore, setLoadingMore] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores]);

  // Default: when a store is selected and no search has been submitted, load the 10 most recent orders.
  useEffect(() => {
    if (selectedStoreId && !submittedQuery) {
      searchOrders(selectedStoreId, '');
    }
  }, [selectedStoreId]);

  const handleSearch = () => {
    const q = query.trim();
    setSubmittedQuery(q);
    if (!selectedStoreId) {
      setResults([]);
      setPageInfo({hasNextPage: false, endCursor: null});
      return;
    }
    searchOrders(selectedStoreId, q);
  };

  const handleClear = () => {
    setQuery('');
    setSubmittedQuery('');
    if (selectedStoreId) {
      searchOrders(selectedStoreId, '');
    } else {
      setResults([]);
      setPageInfo({hasNextPage: false, endCursor: null});
    }
  };

  const handleDuplicate = async (orderGid) => {
    const numericId = numericOrderId(orderGid);
    if (!selectedStoreId || !numericId) return;
    setDuplicatingId(orderGid);
    try {
      const res = await api('/api/analytics/order-duplicate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeId: selectedStoreId, orderId: numericId})
      });
      const result = await res.json();
      if (result.success) {
        const {draftOrderName, adminUrl} = result.data || {};
        setToast({content: `Duplicated as ${draftOrderName || 'new draft'}`, url: adminUrl});
      } else {
        setToast({content: result.error || 'Failed to duplicate order', error: true});
      }
    } catch (e) {
      setToast({content: e.message || 'Failed to duplicate order', error: true});
    } finally {
      setDuplicatingId(null);
    }
  };

  const searchOrders = async (storeId, q, cursor = null) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({storeId, query: q});
      if (cursor) params.set('cursor', cursor);
      const res = await api(`/api/analytics/order-search?${params}`);
      const result = await res.json();
      if (result.success) {
        setResults(prev => (cursor ? [...prev, ...result.data.orders] : result.data.orders));
        setPageInfo(result.data.pageInfo || {hasNextPage: false, endCursor: null});
      }
    } catch {
      /* non-critical */
    } finally {
      cursor ? setLoadingMore(false) : setLoading(false);
    }
  };

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  const fmtUSD = (amount) => {
    const num = parseFloat(amount || 0);
    return `$${num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  };

  const goDetails = (orderGid) => {
    if (!selectedStoreId || !orderGid) return;
    navigate(`/customer-search/${selectedStoreId}/${numericOrderId(orderGid)}`);
  };

  const rows = results.map(o => [
    o.name,
    new Date(o.createdAt).toLocaleDateString(),
    o.customer?.name || 'N/A',
    `${o.currency} ${o.total}`,
    fmtUSD(o.baseCost),
    fmtUSD(o.fee),
    fmtUSD(o.tax),
    <Badge key={`f-${o.id}`} tone={FULFILLMENT_TONE[o.fulfillmentStatus] || 'new'}>
      {o.fulfillmentStatus}
    </Badge>,
    <Badge key={`p-${o.id}`} tone={FINANCIAL_TONE[o.financialStatus] || 'new'}>
      {o.financialStatus}
    </Badge>,
    <InlineStack key={`a-${o.id}`} gap="200">
      <Button size="slim" onClick={() => goDetails(o.id)}>View</Button>
      <Button
        size="slim"
        loading={duplicatingId === o.id}
        disabled={!!duplicatingId && duplicatingId !== o.id}
        onClick={() => handleDuplicate(o.id)}
      >
        Duplicate
      </Button>
    </InlineStack>
  ]);

  return (
    <Page title="Order Search" subtitle="Search orders across your Shopify stores">
      <Layout>
        <Layout.Section>
          <div style={{maxWidth: 300, width: '100%'}}>
            <StoreSelector
              label="Store"
              options={storeOptions}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
              pinnedValues={['']}
            />
          </div>
        </Layout.Section>
        <Layout.Section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <InlineStack gap="200" blockAlign="end" wrap={false}>
              <div style={{flex: 1}}>
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search by order number, customer name, or email... (press Enter to search)"
                  value={query}
                  onChange={setQuery}
                  prefix={
                    <span style={{display: 'flex'}}>
                      <SearchIcon />
                    </span>
                  }
                  clearButton
                  onClearButtonClick={handleClear}
                  autoComplete="off"
                />
              </div>
              <Button variant="primary" submit loading={loading}>
                Search
              </Button>
            </InlineStack>
          </form>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={6} />
            ) : results.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric', 'numeric', 'text', 'text', 'text']}
                  headings={['Order', 'Date', 'Customer', 'Total', 'Base Cost', 'Fee', 'Tax', 'Fulfillment', 'Payment', 'Details']}
                  rows={rows}
                />
                {pageInfo.hasNextPage && (
                  <div style={{padding: '16px', textAlign: 'center'}}>
                    <Button
                      loading={loadingMore}
                      onClick={() =>
                        searchOrders(selectedStoreId, submittedQuery, pageInfo.endCursor)
                      }
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </>
            ) : submittedQuery ? (
              <div style={{padding: 32, textAlign: 'center'}}>
                <Text tone="subdued">No orders found for "{submittedQuery}"</Text>
              </div>
            ) : (
              <EmptyState heading="No recent orders" image="">
                <p>This store has no orders yet, or none could be loaded.</p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
      {toast && (
        <Frame>
          <Toast
            content={toast.content}
            error={toast.error}
            action={toast.url ? {content: 'Open draft', onAction: () => window.open(toast.url, '_blank')} : undefined}
            onDismiss={() => setToast(null)}
            duration={5000}
          />
        </Frame>
      )}
    </Page>
  );
}
