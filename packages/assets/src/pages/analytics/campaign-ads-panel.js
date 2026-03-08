import React, {useState, useEffect} from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Select,
  DataTable,
  SkeletonBodyText,
  Banner,
  Badge,
  Card
} from '@shopify/polaris';
import {api} from '../../helpers/api';

function formatUSD(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(num);
}

/**
 * Campaign Ads Panel — uses shopifyqlQuery to fetch shop_campaign_insights per store.
 * Requires read_analytics scope.
 */
export default function CampaignAdsPanel({stores = []}) {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Auto-select first store
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores]);

  useEffect(() => {
    if (selectedStoreId) fetchCampaignAds(selectedStoreId);
  }, [selectedStoreId]);

  const fetchCampaignAds = async storeId => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await api(`/api/analytics/campaign-ads?storeId=${storeId}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load campaign data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  // Parse rows: columns = [{name, displayName, dataType}], rows = [[val, val, ...], ...]
  // unformattedData is array of arrays
  const rows = data?.rows || [];
  const columns = data?.columns || [];

  // Find ad_spend column index for formatting
  const headings = columns.map(c => c.displayName || c.name);
  const spendColIndexes = columns
    .map((c, i) => (c.name.includes('ad_spend') ? i : -1))
    .filter(i => i >= 0);

  const tableRows = rows.map(row =>
    row.map((cell, i) => (spendColIndexes.includes(i) ? formatUSD(cell) : cell))
  );

  // Calculate total spend from last row if WITH TOTALS was used
  const totalSpend = rows.length > 0 ? rows[rows.length - 1]?.[spendColIndexes[0]] : null;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" wrap={false}>
        <BlockStack gap="100">
          <Text variant="headingMd" as="h2">Shop Campaign Ad Spend</Text>
          <Text variant="bodySm" tone="subdued">Month to date vs previous month — via ShopifyQL</Text>
        </BlockStack>
        {storeOptions.length > 0 && (
          <div style={{minWidth: 220}}>
            <Select
              label=""
              labelHidden
              options={storeOptions}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
            />
          </div>
        )}
      </InlineStack>

      {totalSpend !== null && !loading && (
        <InlineStack gap="200" blockAlign="center">
          <Text variant="heading2xl" as="p">{formatUSD(totalSpend)}</Text>
          <Badge tone="info">MTD Total</Badge>
        </InlineStack>
      )}

      {error && <Banner tone="warning">{error}</Banner>}

      {loading && <SkeletonBodyText lines={6} />}

      {!loading && !error && tableRows.length > 0 && (
        <DataTable
          columnContentTypes={columns.map(c =>
            c.dataType === 'Money' || c.name.includes('spend') ? 'numeric' : 'text'
          )}
          headings={headings}
          rows={tableRows}
        />
      )}

      {!loading && !error && tableRows.length === 0 && data && (
        <Text tone="subdued">No campaign data for this period.</Text>
      )}

      {!loading && !error && !data && stores.length === 0 && (
        <Text tone="subdued">No stores available.</Text>
      )}
    </BlockStack>
  );
}
