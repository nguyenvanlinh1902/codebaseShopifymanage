import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

const VALID_STATUSES = ['needs_response', 'under_review', 'won', 'lost', 'accepted', 'charge_refunded'];

/**
 * GET /api/analytics/disputes
 * Fetch Shopify Payments disputes for stores via REST Admin API.
 * Query params: storeId (optional), status (optional, comma-separated)
 */
export async function getDisputes(req, res) {
  try {
    const {storeId, status} = req.query;
    let activeStores;

    if (storeId) {
      const store = await storeRepo.getById(storeId);
      if (!store || !store.accessToken) {
        return res.status(404).json({success: false, error: 'Store not found'});
      }
      activeStores = [store];
    } else {
      const allStores = await storeRepo.getAll();
      activeStores = allStores.filter(s => s.accessToken);
    }

    // Parse status filter
    const statusFilter = status
      ? status.split(',').filter(s => VALID_STATUSES.includes(s.trim()))
      : [];

    console.log(`[Disputes] Fetching for ${activeStores.length} stores, status: ${statusFilter.join(',') || 'all'}`);

    const results = await Promise.all(
      activeStores.map(async store => {
        try {
          const storeDisputes = await fetchStoreDisputes(store, statusFilter);
          console.log(`[Disputes] ${store.shopDomain}: ${storeDisputes.length} disputes`);
          return storeDisputes;
        } catch (err) {
          console.error(`[Disputes] Error for ${store.shopDomain}:`, err.message);
          return [];
        }
      })
    );

    const disputes = results.flat().sort((a, b) =>
      new Date(b.initiatedAt || 0) - new Date(a.initiatedAt || 0)
    );

    console.log(`[Disputes] Total disputes: ${disputes.length}`);
    return res.json({success: true, data: disputes});
  } catch (error) {
    console.error('Disputes error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

async function fetchStoreDisputes(store, statusFilter = []) {
  const baseUrl = `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}`;
  const headers = {
    'X-Shopify-Access-Token': store.accessToken,
    'Content-Type': 'application/json'
  };

  // If status filter provided, fetch each status separately (REST API accepts single status)
  // Otherwise fetch all disputes
  if (statusFilter.length > 0) {
    const results = await Promise.all(
      statusFilter.map(s => fetchDisputesPage(baseUrl, headers, s))
    );
    const allDisputes = results.flat();
    return mapDisputes(allDisputes, store);
  }

  const allDisputes = await fetchDisputesPage(baseUrl, headers);
  return mapDisputes(allDisputes, store);
}

async function fetchDisputesPage(baseUrl, headers, status = null) {
  let url = `${baseUrl}/shopify_payments/disputes.json`;
  if (status) url += `?status=${status}`;

  const response = await fetch(url, {method: 'GET', headers});

  if (!response.ok) {
    // 404 = Shopify Payments not enabled on this store, skip silently
    if (response.status !== 404) {
      const text = await response.text();
      console.error(`[Disputes] REST ${response.status}: ${text.slice(0, 500)}`);
    }
    return [];
  }

  const json = await response.json();
  return json.disputes || [];
}

function mapDisputes(disputes, store) {
  return disputes.map(d => ({
    store: store.name || store.shopDomain,
    storeId: store.id,
    shopDomain: store.shopDomain,
    disputeId: d.id,
    orderId: d.order_id,
    orderName: d.order_id ? `#${d.order_id}` : 'N/A',
    initiatedAt: d.initiated_at,
    evidenceDueBy: d.evidence_due_by,
    evidenceSentOn: d.evidence_sent_on,
    finalizedOn: d.finalized_on,
    reason: d.reason || 'Unknown',
    networkReasonCode: d.network_reason_code || null,
    status: d.status || 'unknown',
    amount: d.amount || '0.00',
    currency: d.currency || 'USD',
    type: d.type || 'unknown',
    adminUrl: `https://admin.shopify.com/store/${store.shopDomain}/orders?chargeback_status=${d.status || 'needs_response'}&status=any`
  }));
}
