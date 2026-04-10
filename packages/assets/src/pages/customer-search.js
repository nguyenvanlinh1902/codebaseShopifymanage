import React, {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  Page,
  Layout,
  TextField,
  Card,
  DataTable,
  Badge,
  Button,
  Text,
  Banner,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

import {FULFILLMENT_TONE, FINANCIAL_TONE} from '../helpers/order-status-tones';

// Extract numeric order id from Shopify GID: "gid://shopify/Order/123" → "123"
const numericOrderId = gid => String(gid || '').split('/').pop();

export default function CustomerSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [totalStores, setTotalStores] = useState(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setWarnings([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const runSearch = async q => {
    setLoading(true);
    try {
      const params = new URLSearchParams({query: q});
      const res = await api(`/api/analytics/customer-search?${params}`);
      const result = await res.json();
      if (result.success) {
        setResults(result.data.orders || []);
        setWarnings(result.data.warnings || []);
        setTotalStores(result.data.totalStores || 0);
      }
    } catch (err) {
      console.warn('Customer search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const goDetails = (storeId, orderGid) => {
    if (!storeId || !orderGid) return;
    navigate(`/customer-search/${storeId}/${numericOrderId(orderGid)}`);
  };

  const rows = results.map(o => [
    o.name,
    o.store?.name || o.store?.shopDomain || 'N/A',
    o.customer?.name || 'N/A',
    o.customer?.email || '-',
    new Date(o.createdAt).toLocaleDateString(),
    `${o.currency} ${o.total}`,
    <Badge key={`f-${o.id}`} tone={FULFILLMENT_TONE[o.fulfillmentStatus] || 'new'}>
      {o.fulfillmentStatus}
    </Badge>,
    <Badge key={`p-${o.id}`} tone={FINANCIAL_TONE[o.financialStatus] || 'new'}>
      {o.financialStatus}
    </Badge>,
    <Button key={`v-${o.id}`} size="slim" onClick={() => goDetails(o.store?.id, o.id)}>
      View
    </Button>
  ]);

  return (
    <Page
      title="Customer Search"
      subtitle={`Search orders by customer email or name across all stores${totalStores ? ` (${totalStores} stores)` : ''}`}
    >
      <Layout>
        <Layout.Section>
          <TextField
            label="Search"
            labelHidden
            placeholder="Search by customer email or name..."
            value={query}
            onChange={setQuery}
            prefix={
              <span style={{display: 'flex'}}>
                <SearchIcon />
              </span>
            }
            clearButton
            onClearButtonClick={() => setQuery('')}
            autoComplete="off"
          />
        </Layout.Section>

        {warnings.length > 0 && (
          <Layout.Section>
            <Banner tone="warning" title={`${warnings.length} store(s) failed to respond`}>
              <ul style={{margin: 0, paddingLeft: 20}}>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={6} />
            ) : results.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric', 'text', 'text', 'text']}
                headings={['Order', 'Store', 'Customer', 'Email', 'Date', 'Total', 'Fulfillment', 'Payment', 'Details']}
                rows={rows}
              />
            ) : query.trim().length >= 2 ? (
              <div style={{padding: 32, textAlign: 'center'}}>
                <Text tone="subdued">No customers found for "{query}"</Text>
              </div>
            ) : (
              <EmptyState heading="Search customers across all stores" image="">
                <p>Enter a customer email or name (min 2 characters) to search.</p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
