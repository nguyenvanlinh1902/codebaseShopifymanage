import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import shopifyConfig from '../config/shopify.js';
import {extractStoreIds, hasStoreAccess} from '../utils/store-access.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

const VALID_STATUSES = ['needs_response', 'under_review', 'won', 'lost', 'accepted', 'charge_refunded'];

/**
 * GET /api/analytics/disputes
 * Fetch Shopify Payments disputes for stores via REST Admin API.
 * Query params: storeId (optional), status (optional, comma-separated)
 */
export async function getDisputes(req, res) {
  try {
    const {storeId, status} = req.query;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';
    let activeStores;

    if (storeId) {
      const store = await storeRepo.getById(storeId);
      if (!store || !store.accessToken) {
        return res.status(404).json({success: false, error: 'Store not found'});
      }
      // Access check for non-admin
      if (!isAdmin) {
        const userRecord = await adminUserRepo.getById(userId);
        if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
          return res.status(403).json({success: false, error: 'Access denied to this store'});
        }
      }
      activeStores = [store];
    } else {
      let stores;
      if (isAdmin) {
        stores = await storeRepo.getAll();
      } else {
        const userRecord = await adminUserRepo.getById(userId);
        const assignedIds = extractStoreIds(userRecord?.assignedStores);
        stores = assignedIds.length > 0 ? await storeRepo.getByIds(assignedIds) : [];
      }
      activeStores = stores.filter(s => s.accessToken);
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
    return await mapDisputes(allDisputes, store);
  }

  const allDisputes = await fetchDisputesPage(baseUrl, headers);
  return await mapDisputes(allDisputes, store);
}

async function fetchDisputesPage(baseUrl, headers, status = null) {
  let url = `${baseUrl}/shopify_payments/disputes.json`;
  if (status) url += `?status=${status}`;

  const response = await fetch(url, {method: 'GET', headers});

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) {
      console.log(`[Disputes] ${url} → 404 (Shopify Payments not enabled), skipping`);
    } else {
      console.error(`[Disputes] ${url} → HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    return [];
  }

  const json = await response.json();
  console.log(`[Disputes] ${url} → ${(json.disputes || []).length} disputes`);
  return json.disputes || [];
}

async function mapDisputes(disputes, store) {
  const baseUrl = `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}`;
  const headers = {
    'X-Shopify-Access-Token': store.accessToken,
    'Content-Type': 'application/json'
  };

  // Log raw dispute data for debugging
  console.log(`[Disputes][${store.shopDomain}] Raw disputes (${disputes.length}):`, JSON.stringify(
    disputes.map(d => ({id: d.id, order_id: d.order_id, status: d.status, reason: d.reason, amount: d.amount, currency: d.currency}))
  ));

  // Fetch order details (number + email) for disputes that have order_id
  const orderIds = [...new Set(disputes.filter(d => d.order_id).map(d => d.order_id))];
  console.log(`[Disputes][${store.shopDomain}] Fetching ${orderIds.length} orders for email: ${orderIds.join(', ')}`);

  const orderMap = {};
  await Promise.all(
    orderIds.map(async orderId => {
      try {
        const res = await fetch(`${baseUrl}/orders/${orderId}.json?fields=id,name,email`, {
          method: 'GET',
          headers
        });
        if (res.ok) {
          const json = await res.json();
          orderMap[orderId] = {name: json.order?.name, email: json.order?.email};
          console.log(`[Disputes][${store.shopDomain}] Order ${orderId}: name=${json.order?.name} email=${json.order?.email}`);
        } else if (res.status === 404) {
          // Order was deleted from Shopify — dispute still references old order_id
          orderMap[orderId] = {name: null, email: '', deleted: true};
          console.warn(`[Disputes][${store.shopDomain}] Order ${orderId} was deleted (404)`);
        } else {
          const text = await res.text();
          console.error(`[Disputes][${store.shopDomain}] Order ${orderId} fetch failed: HTTP ${res.status} - ${text.slice(0, 300)}`);
        }
      } catch (err) {
        console.error(`[Disputes][${store.shopDomain}] Order ${orderId} fetch error:`, err.message);
      }
    })
  );

  return disputes.map(d => {
    const order = orderMap[d.order_id] || {};
    const orderDeleted = order.deleted === true;
    return {
      store: store.name || store.shopDomain,
      storeId: store.id,
      shopDomain: store.shopDomain,
      disputeId: d.id,
      orderId: d.order_id,
      orderName: order.name || (d.order_id ? `#${d.order_id}` : 'N/A'),
      email: order.email || '',
      orderDeleted,
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
    };
  });
}
