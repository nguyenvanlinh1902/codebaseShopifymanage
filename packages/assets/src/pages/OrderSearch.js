import React, {useState, useEffect, useRef} from 'react';
import {Page, Layout, Select, InlineStack, TextField, Card, DataTable, Badge, Link, Button, Text, SkeletonBodyText, EmptyState} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';

const FULFILLMENT_TONE = {FULFILLED: 'success', UNFULFILLED: 'attention', PARTIALLY_FULFILLED: 'info', IN_PROGRESS: 'info'};
const FINANCIAL_TONE = {PAID: 'success', PENDING: 'attention', REFUNDED: 'info', PARTIALLY_REFUNDED: 'warning', VOIDED: 'critical'};

export default function OrderSearch() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({hasNextPage: false, endCursor: null});
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetchStores();
    api('/api/store-groups').then(r => r.json()).then(d => { if (d.success) setGroups(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    const filtered = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
    if (filtered.length > 0) setSelectedStoreId(filtered[0].id);
    else if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, groupFilter]);

  // Debounced search
  useEffect(() => {
    if (!selectedStoreId || !query.trim()) {
      setResults([]);
      setPageInfo({hasNextPage: false, endCursor: null});
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOrders(selectedStoreId, query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedStoreId]);

  const fetchStores = async () => {
    try {
      const res = await api('/api/stores?limit=100');
      const result = await res.json();
      if (result.success) {
        const all = result.data || [];
        setStores(isAdmin ? all : all.filter(s => (user?.assignedStores || []).includes(s.id)));
      }
    } catch { /* non-critical */ }
  };

  const searchOrders = async (storeId, q, cursor = null) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({storeId, query: q});
      if (cursor) params.set('cursor', cursor);
      const res = await api(`/api/analytics/order-search?${params}`);
      const result = await res.json();
      if (result.success) {
        setResults(prev => cursor ? [...prev, ...result.data.orders] : result.data.orders);
        setPageInfo(result.data.pageInfo || {hasNextPage: false, endCursor: null});
      }
    } catch { /* non-critical */ }
    finally { cursor ? setLoadingMore(false) : setLoading(false); }
  };

  const visibleStores = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
  const storeOptions = visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}));
  const groupOptions = [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))];

  const rows = results.map(o => [
    <Link key={o.id} url={o.adminUrl} external>{o.name}</Link>,
    new Date(o.createdAt).toLocaleDateString(),
    o.customer?.name || 'N/A',
    `${o.currency} ${o.total}`,
    <Badge key={`f-${o.id}`} tone={FULFILLMENT_TONE[o.fulfillmentStatus] || 'new'}>{o.fulfillmentStatus}</Badge>,
    <Badge key={`p-${o.id}`} tone={FINANCIAL_TONE[o.financialStatus] || 'new'}>{o.financialStatus}</Badge>
  ]);

  return (
    <Page title="Order Search" subtitle="Search orders across your Shopify stores">
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
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <TextField
            label="Search"
            labelHidden
            placeholder="Search by order number, customer name, or email..."
            value={query}
            onChange={setQuery}
            prefix={<span style={{display: 'flex'}}><SearchIcon /></span>}
            clearButton
            onClearButtonClick={() => setQuery('')}
            autoComplete="off"
          />
        </Layout.Section>
        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={6} />
            ) : results.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                  headings={['Order', 'Date', 'Customer', 'Total', 'Fulfillment', 'Payment']}
                  rows={rows}
                />
                {pageInfo.hasNextPage && (
                  <div style={{padding: '16px', textAlign: 'center'}}>
                    <Button loading={loadingMore} onClick={() => searchOrders(selectedStoreId, query.trim(), pageInfo.endCursor)}>
                      Load more
                    </Button>
                  </div>
                )}
              </>
            ) : query.trim() ? (
              <div style={{padding: 32, textAlign: 'center'}}>
                <Text tone="subdued">No orders found for "{query}"</Text>
              </div>
            ) : (
              <EmptyState heading="Search for orders" image="">
                <p>Enter an order number, customer name, or email to search.</p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
