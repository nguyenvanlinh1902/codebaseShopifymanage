import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

const BALANCE_QUERY = `{ shopifyPaymentsAccount { balance { currency amount } } }`;

/**
 * Fetch Shopify Payments balance for a single store via GraphQL.
 * Returns null if store has no Shopify Payments or token is invalid.
 */
async function fetchStoreBalance(shopDomain, accessToken) {
  try {
    const res = await fetch(
      `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query: BALANCE_QUERY})
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const balance = data?.data?.shopifyPaymentsAccount?.balance;
    return balance ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/stores/balances
 * Fetch Shopify Payments balance for all active stores concurrently.
 * Admin only.
 */
export async function getAllBalances(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(s => s.status === 'active' && s.accessToken && s.shopDomain);

    const results = await Promise.all(
      activeStores.map(async store => {
        const balance = await fetchStoreBalance(store.shopDomain, store.accessToken);
        return {storeId: store.id, shopDomain: store.shopDomain, balance};
      })
    );

    // Map storeId -> balance for easy lookup on frontend
    const balanceMap = {};
    for (const r of results) {
      balanceMap[r.storeId] = r.balance;
    }

    return res.json({success: true, data: balanceMap});
  } catch (error) {
    console.error('Get all balances error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
