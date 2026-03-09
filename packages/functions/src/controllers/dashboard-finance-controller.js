import {StoreRepository} from '../repositories/storeRepository.js';
import {runShopifyQL} from '../helpers/shopifyql-runner.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

/**
 * GET /api/dashboard/finance-summary
 * Admin-only. Returns daily revenue + ad spend rows for past year + payout balance.
 * Frontend aggregates by period client-side — single fetch on page load.
 * Note: balance from Shopify Payments API = "Payout balance" (money not yet included in a payout).
 * "Shopify Balance" (Accounts) is a US-only product with no public API.
 */
export async function getFinanceSummary(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(s => s.status === 'active' && s.accessToken);

    const stores = await Promise.all(
      activeStores.map(async store => {
        const [revenueDays, adSpendDays, payoutBalance] = await Promise.all([
          fetchDailyRevenue(store).catch(() => []),
          fetchDailyAdSpend(store).catch(() => []),
          fetchPayoutBalance(store).catch(() => ({amount: 0, currency: 'USD'}))
        ]);
        return {
          storeId: store.id,
          name: store.name || store.shopDomain,
          shopDomain: store.shopDomain,
          groupId: store.groupId || null,
          revenueDays,
          adSpendDays,
          payoutBalance
        };
      })
    );

    return res.json({success: true, data: {stores}});
  } catch (error) {
    console.error('Finance summary error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

async function fetchDailyRevenue(store) {
  const result = await runShopifyQL(
    store.shopDomain,
    store.accessToken,
    'FROM sales SHOW net_sales, total_sales GROUP BY day SINCE -365d UNTIL today'
  );
  return (result?.tableData?.rows || []).map(r => ({
    day: r.day,
    value: parseFloat(r.net_sales || 0),
    totalSales: parseFloat(r.total_sales || 0)
  }));
}

async function fetchDailyAdSpend(store) {
  const result = await runShopifyQL(
    store.shopDomain,
    store.accessToken,
    'FROM shop_campaign_insights SHOW shop_campaign_ad_spend GROUP BY day SINCE -365d UNTIL today'
  );
  return (result?.tableData?.rows || []).map(r => ({
    day: r.day,
    value: parseFloat(r.shop_campaign_ad_spend || 0)
  }));
}

/**
 * Fetch payout balance via REST API.
 * This returns "the account's current balance comprised of any Transaction not yet included in a Payout"
 * = "Payout balance" on Shopify Finance page.
 */
async function fetchPayoutBalance(store) {
  try {
    const url = `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/shopify_payments/balance.json`;
    const response = await fetch(url, {
      headers: {'X-Shopify-Access-Token': store.accessToken}
    });
    if (!response.ok) return {amount: 0, currency: 'USD'};
    const data = await response.json();
    const bal = data?.balance?.[0];
    return bal
      ? {amount: parseFloat(bal.amount || 0), currency: bal.currency || 'USD'}
      : {amount: 0, currency: 'USD'};
  } catch {
    return {amount: 0, currency: 'USD'};
  }
}
