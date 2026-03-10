import React, {useState, useEffect} from 'react';
import {BlockStack, Text, DataTable, SkeletonBodyText, Banner, Badge, InlineStack} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {TIME_PARAMS} from './campaign-ads-time-options';

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

/**
 * Campaign Ads Panel — daily ad spend for a single store.
 * Controlled: storeId + timePeriod are passed from parent (CampaignAds page).
 */
export default function CampaignAdsPanel({storeId = '', timePeriod = 'this_month'}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId) return;
    const params = TIME_PARAMS[timePeriod] || TIME_PARAMS.this_month;
    const qs = new URLSearchParams({storeId, since: params.since, until: params.until, compareTo: 'none'});

    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);

    api(`/api/analytics/campaign-ads?${qs}`)
      .then(r => r.json())
      .then(result => {
        if (cancelled) return;
        if (result.success) setData(result.data);
        else setError(result.error || 'Failed to load campaign data');
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [storeId, timePeriod]);

  // Parse ShopifyQL columns/rows
  const columns = data?.columns || [];
  const rawRows = data?.rows || [];
  const parsedRows = typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows;
  const allRows = Array.isArray(parsedRows)
    ? parsedRows.map(row => (Array.isArray(row) ? row : columns.map(c => row[c.name] ?? '')))
    : [];

  const dayColIdx = columns.findIndex(c => c.name === 'day');
  const spendColIdx = columns.findIndex(c => c.name === 'shop_campaign_ad_spend');
  const hasData = dayColIdx >= 0 && spendColIdx >= 0;

  const displayRows = hasData
    ? allRows
        .filter(row => row[dayColIdx] && row[dayColIdx] !== 'Total')
        .map(row => [formatDay(row[dayColIdx]), formatUSD(row[spendColIdx])])
    : [];

  const totalSpend = hasData
    ? allRows.reduce((sum, row) => {
        const val = parseFloat(row[spendColIdx]);
        return sum + (isNaN(val) ? 0 : val);
      }, 0)
    : 0;

  if (!storeId) return <Text tone="subdued">Select a store to view campaign data.</Text>;

  return (
    <BlockStack gap="400">
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
    </BlockStack>
  );
}
