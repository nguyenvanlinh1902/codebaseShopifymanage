import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

const PAYOUTS_QUERY = `{
  shopifyPaymentsAccount {
    payouts(first: 5, reverse: true) {
      nodes { id net { amount currencyCode } status issuedAt transactionType }
    }
  }
}`;

/**
 * Fetch account balance via REST API (works with read_shopify_payments_payouts scope).
 */
async function fetchAccountBalance(shopDomain, accessToken) {
  const url =
    `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}` +
    '/shopify_payments/balance.json';
  const res = await fetch(url, {
    headers: {'X-Shopify-Access-Token': accessToken}
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[Balance] REST error for ${shopDomain}: ${res.status}`, errText);
    return null;
  }
  const data = await res.json();
  return data?.balance || null;
}

/**
 * Fetch recent payouts via GraphQL.
 */
async function fetchPayouts(shopDomain, accessToken) {
  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query: PAYOUTS_QUERY})
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.data?.shopifyPaymentsAccount?.payouts?.nodes || [];
}

/**
 * Fetch balance + payouts for a single store.
 */
async function fetchStoreBalance(shopDomain, accessToken) {
  try {
    const [balanceArray, payouts] = await Promise.all([
      fetchAccountBalance(shopDomain, accessToken),
      fetchPayouts(shopDomain, accessToken)
    ]);

    if (!balanceArray || balanceArray.length === 0) {
      return {balance: null, payouts, reason: 'Shopify Payments not enabled or no balance data'};
    }

    const balance =
      balanceArray.length === 1
        ? {amount: balanceArray[0].amount, currencyCode: balanceArray[0].currency}
        : balanceArray.map(b => ({amount: b.amount, currencyCode: b.currency}));

    return {balance, payouts, reason: null};
  } catch (err) {
    console.error(`[Balance] Error for ${shopDomain}:`, err.message);
    return {balance: null, payouts: [], reason: err.message};
  }
}

/**
 * GET /api/stores/balance?storeId=xxx
 * Fetch balance for a single store — useful for debugging.
 */
export async function getStoreBalance(req, res) {
  try {
    const {storeId} = req.query;
    if (!storeId) return res.status(400).json({success: false, error: 'storeId required'});

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const result = await fetchStoreBalance(store.shopDomain, store.accessToken);
    return res.json({success: true, store: store.shopDomain, ...result});
  } catch (error) {
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/stores/balances
 * Fetch Shopify Payments balance + payouts for all active stores.
 */
export async function getAllBalances(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(
      s => s.status === 'active' && s.accessToken && s.shopDomain
    );

    const results = await Promise.all(
      activeStores.map(async store => {
        const result = await fetchStoreBalance(store.shopDomain, store.accessToken);
        return {storeId: store.id, shopDomain: store.shopDomain, ...result};
      })
    );

    const balanceMap = {};
    for (const r of results) {
      balanceMap[r.storeId] = {
        balance: r.balance,
        payouts: r.payouts,
        reason: r.reason
      };
    }

    return res.json({success: true, data: balanceMap});
  } catch (error) {
    console.error('Get all balances error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
