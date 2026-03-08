import React, {useState, useEffect} from 'react';
import {BlockStack, InlineStack, Text, Select, DataTable, SkeletonBodyText, Banner, Badge} from '@shopify/polaris';
import {api} from '../../helpers/api';

function formatUSD(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(num);
}

function formatDay(val) {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
  } catch {
    return String(val);
  }
}

const TIME_OPTIONS = [
  {label: 'This month', value: 'this_month'},
  {label: 'Last 7 days', value: 'last_7'},
  {label: 'Last 30 days', value: 'last_30'},
  {label: 'Last month', value: 'last_month'},
  {label: 'This year', value: 'this_year'}
];

const TIME_PARAMS = {
  this_month: {since: 'startOfMonth(0m)', until: 'today'},
  last_7: {since: '-7d', until: 'today'},
  last_30: {since: '-30d', until: 'today'},
  last_month: {since: 'startOfMonth(-1m)', until: 'endOfMonth(-1m)'},
  this_year: {since: 'startOfYear(0y)', until: 'today'}
};

/**
 * Campaign Ads Panel — clean display of ad spend data via ShopifyQL.
 */
export default function CampaignAdsPanel({stores = []}) {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [timePeriod, setTimePeriod] = useState('this_month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores]);

  useEffect(() => {
    if (selectedStoreId) fetchCampaignAds(selectedStoreId, timePeriod);
  }, [selectedStoreId, timePeriod]);

  const fetchCampaignAds = async (storeId, period) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const params = TIME_PARAMS[period] || TIME_PARAMS.this_month;
      const qs = new URLSearchParams({
        storeId,
        since: params.since,
        until: params.until,
        compareTo: 'none'
      });
      const res = await api(`/api/analytics/campaign-ads?${qs}`);
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

  // Parse and clean data
  const columns = data?.columns || [];
  const rawRows = data?.rows || [];
  const parsedRows = typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows;
  const allRows = Array.isArray(parsedRows)
    ? parsedRows.map(row => (Array.isArray(row) ? row : columns.map(c => row[c.name] ?? '')))
    : [];

  // Filter out totals row and comparison columns
  const dayColIdx = columns.findIndex(c => c.name === 'day');
  const spendColIdx = columns.findIndex(c => c.name === 'shop_campaign_ad_spend');

  const hasData = dayColIdx >= 0 && spendColIdx >= 0;
  const displayRows = hasData
    ? allRows
        .filter(row => row[dayColIdx] && row[dayColIdx] !== 'Total')
        .map(row => [formatDay(row[dayColIdx]), formatUSD(row[spendColIdx])])
    : [];

  // Total from all rows
  const totalSpend = hasData
    ? allRows.reduce((sum, row) => {
        const val = parseFloat(row[spendColIdx]);
        return sum + (isNaN(val) ? 0 : val);
      }, 0)
    : 0;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="end" wrap>
        <BlockStack gap="100">
          <Text variant="headingMd" as="h2">Campaign Ad Spend</Text>
          <Text variant="bodySm" tone="subdued">Daily ad spend via ShopifyQL</Text>
        </BlockStack>
        <InlineStack gap="300">
          <div style={{minWidth: 160}}>
            <Select
              label="Period"
              labelHidden
              options={TIME_OPTIONS}
              value={timePeriod}
              onChange={setTimePeriod}
            />
          </div>
          {storeOptions.length > 0 && (
            <div style={{minWidth: 220}}>
              <Select
                label="Store"
                labelHidden
                options={storeOptions}
                value={selectedStoreId}
                onChange={setSelectedStoreId}
              />
            </div>
          )}
        </InlineStack>
      </InlineStack>

      {totalSpend > 0 && !loading && (
        <InlineStack gap="200" blockAlign="center">
          <Text variant="heading2xl" as="p">{formatUSD(totalSpend)}</Text>
          <Badge tone="info">Total</Badge>
        </InlineStack>
      )}

      {error && <Banner tone="warning">{error}</Banner>}

      {loading && <SkeletonBodyText lines={6} />}

      {!loading && !error && displayRows.length > 0 && (
        <DataTable
          columnContentTypes={['text', 'numeric']}
          headings={['Date', 'Ad Spend']}
          rows={displayRows}
          totals={totalSpend > 0 ? ['', formatUSD(totalSpend)] : undefined}
        />
      )}

      {!loading && !error && displayRows.length === 0 && data && (
        <Text tone="subdued">No campaign data for this period.</Text>
      )}

      {!loading && !error && !data && stores.length === 0 && (
        <Text tone="subdued">No stores available.</Text>
      )}
    </BlockStack>
  );
}
