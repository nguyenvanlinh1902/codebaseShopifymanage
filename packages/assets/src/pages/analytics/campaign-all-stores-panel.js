import React, {useState, useEffect} from 'react';
import {BlockStack, Text, DataTable, SkeletonBodyText, Banner, Badge, InlineStack} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {TIME_PARAMS} from './campaign-ads-time-options';

function formatUSD(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(num);
}

/**
 * Compute total ad spend from ShopifyQL columns/rows response.
 */
function computeTotal(columns, rows) {
  const spendColIdx = (columns || []).findIndex(c => c.name === 'shop_campaign_ad_spend');
  if (spendColIdx < 0 || !rows?.length) return 0;
  const parsed = typeof rows === 'string' ? JSON.parse(rows) : rows;
  return (Array.isArray(parsed) ? parsed : []).reduce((sum, row) => {
    const arr = Array.isArray(row) ? row : (columns || []).map(c => row[c.name] ?? '');
    const val = parseFloat(arr[spendColIdx]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

/**
 * Campaign Ads — All Stores summary table.
 * Controlled: timePeriod is passed from parent (CampaignAds page).
 * Shows store name + total ad spend. Admin sees all stores; non-admin sees assigned stores.
 */
/**
 * @param {string} timePeriod - selected time period key
 * @param {string[]|null} filterStoreIds - when set (group selected), only show these store IDs
 */
export default function CampaignAllStoresPanel({timePeriod = 'this_month', filterStoreIds = null}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = TIME_PARAMS[timePeriod] || TIME_PARAMS.this_month;
    const qs = new URLSearchParams({since: params.since, until: params.until});

    let cancelled = false;
    setLoading(true);
    setError('');
    setRows([]);

    api(`/api/analytics/campaign-ads/all-stores?${qs}`)
      .then(r => r.json())
      .then(result => {
        if (cancelled) return;
        if (!result.success) { setError(result.error || 'Failed to load data'); return; }

        const allowedIds = filterStoreIds ? new Set(filterStoreIds) : null;
        const storeRows = (result.data || [])
          .filter(store => !allowedIds || allowedIds.has(store.storeId))
          .map(store => ({
            name: store.name || store.shopDomain,
            total: store.error ? null : computeTotal(store.columns, store.rows),
            hasError: !!store.error
          }));

        // Sort descending by spend; error stores at bottom
        storeRows.sort((a, b) => {
          if (a.total === null && b.total === null) return 0;
          if (a.total === null) return 1;
          if (b.total === null) return -1;
          return b.total - a.total;
        });

        setRows(storeRows);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod, JSON.stringify(filterStoreIds)]);

  const grandTotal = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);

  const tableRows = rows.map(r => [
    r.name,
    r.hasError ? <Badge key={r.name} tone="warning">Error</Badge> : formatUSD(r.total)
  ]);

  return (
    <BlockStack gap="400">
      {grandTotal > 0 && !loading && (
        <InlineStack gap="200" blockAlign="center">
          <Text variant="heading2xl" as="p">{formatUSD(grandTotal)}</Text>
          <Badge tone="info">Grand Total</Badge>
        </InlineStack>
      )}

      {error && <Banner tone="warning">{error}</Banner>}
      {loading && <SkeletonBodyText lines={6} />}

      {!loading && !error && tableRows.length > 0 && (
        <DataTable
          columnContentTypes={['text', 'numeric']}
          headings={['Store', 'Total Ad Spend']}
          rows={tableRows}
          totals={grandTotal > 0 ? ['', formatUSD(grandTotal)] : undefined}
        />
      )}

      {!loading && !error && tableRows.length === 0 && (
        <Text tone="subdued">No campaign data for this period.</Text>
      )}
    </BlockStack>
  );
}
