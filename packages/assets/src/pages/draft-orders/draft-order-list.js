import React, {useState, useEffect} from 'react';
import {
  Page, Layout, Card, Select, Button, Text, Badge,
  DataTable, InlineStack, Box, SkeletonBodyText, EmptyState
} from '@shopify/polaris';
import {PlusIcon, ExternalIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const STATUS_TONE = {OPEN: 'info', INVOICE_SENT: 'attention', COMPLETED: 'success'};

export default function DraftOrderList({storeId, storeOptions, onStoreChange, onCreate, onEdit}) {
  const [draftOrders, setDraftOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({hasNextPage: false, endCursor: null});
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (storeId) fetchDraftOrders();
  }, [storeId]);

  const fetchDraftOrders = async (cursor = null) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({storeId});
      if (cursor) params.set('cursor', cursor);
      const res = await api(`/api/draft-orders?${params}`);
      const result = await res.json();
      if (result.success) {
        setDraftOrders(prev =>
          cursor ? [...prev, ...result.data.draftOrders] : result.data.draftOrders
        );
        setPageInfo(result.data.pageInfo || {hasNextPage: false, endCursor: null});
      }
    } catch (err) {
      console.warn('Fetch draft orders failed:', err);
    } finally {
      cursor ? setLoadingMore(false) : setLoading(false);
    }
  };

  const rows = draftOrders.map(d => {
    const numericId = d.id.split('/').pop();
    return [
      d.name,
      new Date(d.createdAt).toLocaleDateString(),
      d.customer?.name || 'No customer',
      `${d.currency} ${parseFloat(d.total).toFixed(2)}`,
      <Badge key={`s-${d.id}`} tone={STATUS_TONE[d.status] || 'new'}>
        {d.status}
      </Badge>,
      <InlineStack key={`a-${d.id}`} gap="200">
        {d.status === 'OPEN' && (
          <Button size="slim" onClick={() => onEdit(numericId)}>
            Edit
          </Button>
        )}
        <Button size="slim" icon={ExternalIcon} url={d.adminUrl} external>
          View
        </Button>
      </InlineStack>
    ];
  });

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
            ) : rows.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                  headings={['Order', 'Date', 'Customer', 'Total', 'Status', '']}
                  rows={rows}
                />
                {pageInfo.hasNextPage && (
                  <Box padding="400">
                    <InlineStack align="center">
                      <Button
                        loading={loadingMore}
                        onClick={() => fetchDraftOrders(pageInfo.endCursor)}
                      >
                        Load more
                      </Button>
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
    </Page>
  );
}
