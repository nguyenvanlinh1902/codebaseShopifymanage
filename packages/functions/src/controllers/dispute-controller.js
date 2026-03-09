import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

/**
 * GET /api/analytics/disputes
 * Fetch open Shopify Payments disputes for all active stores.
 * Returns: [{store, orderId, orderName, initiatedAt, evidenceDueBy, reason, status, amount}]
 */
export async function getDisputes(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(s => s.status === 'active' && s.accessToken);

    const results = await Promise.all(
      activeStores.map(async store => {
        try {
          return await fetchStoreDisputes(store);
        } catch (err) {
          console.error(`[Disputes] Error for ${store.shopDomain}:`, err.message);
          return [];
        }
      })
    );

    const disputes = results.flat().sort((a, b) =>
      new Date(a.evidenceDueBy || 0) - new Date(b.evidenceDueBy || 0)
    );

    return res.json({success: true, data: disputes});
  } catch (error) {
    console.error('Disputes error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

async function fetchStoreDisputes(store) {
  const url =
    `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}` +
    '/shopify_payments/disputes.json?status=open,needs_response,under_review';

  const response = await fetch(url, {
    headers: {'X-Shopify-Access-Token': store.accessToken}
  });

  if (!response.ok) return [];
  const data = await response.json();
  const disputes = data?.disputes || [];

  return disputes.map(d => ({
    store: store.name || store.shopDomain,
    storeId: store.id,
    shopDomain: store.shopDomain,
    disputeId: d.id,
    orderId: d.order_id,
    orderName: d.order_id ? `#${d.order_id}` : 'N/A',
    initiatedAt: d.initiated_at,
    evidenceDueBy: d.evidence_due_by,
    reason: d.reason || 'Unknown',
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    type: d.type,
    adminUrl: `https://${store.shopDomain}.myshopify.com/admin/payments/disputes/${d.id}`
  }));
}
