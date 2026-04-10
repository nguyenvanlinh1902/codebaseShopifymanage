import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import shopifyConfig from '../config/shopify.js';
import {extractStoreIds, hasStoreAccess} from '../utils/store-access.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

const SEARCH_ORDERS_QUERY = `
query SearchOrders($query: String!, $first: Int!, $after: String) {
  orders(query: $query, first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount currencyCode } }
        displayFulfillmentStatus
        displayFinancialStatus
        customer { firstName lastName email }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ORDER_DETAILS_QUERY = `
query OrderDetails($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    processedAt
    note
    tags
    displayFulfillmentStatus
    displayFinancialStatus
    totalPriceSet { shopMoney { amount currencyCode } }
    subtotalPriceSet { shopMoney { amount currencyCode } }
    totalTaxSet { shopMoney { amount currencyCode } }
    totalShippingPriceSet { shopMoney { amount currencyCode } }
    totalDiscountsSet { shopMoney { amount currencyCode } }
    totalRefundedSet { shopMoney { amount currencyCode } }
    customer {
      firstName
      lastName
      email
      phone
    }
    shippingAddress {
      name
      address1
      address2
      city
      province
      country
      zip
      phone
    }
    billingAddress {
      name
      address1
      city
      province
      country
      zip
    }
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          variantTitle
          sku
          image { url altText }
          originalUnitPriceSet { shopMoney { amount currencyCode } }
          discountedUnitPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
    fulfillments(first: 10) {
      trackingInfo { number url company }
      status
      createdAt
    }
  }
}`;

// Sanitize keyword — escape quotes/backslashes to prevent GraphQL injection
function sanitizeKeyword(q) {
  return String(q || '').replace(/[\\"/]/g, ' ').trim();
}

/**
 * Shared helper: fetch orders from a single Shopify store via GraphQL.
 * Returns normalized orders list + pageInfo + store metadata.
 * Throws on network / HTTP / GraphQL errors so callers can handle them.
 */
async function fetchOrdersFromStore(store, shopifyQuery, {cursor = null, limit = 25, timeoutMs = 5000} = {}) {
  const variables = {query: shopifyQuery, first: limit, after: cursor || null};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(
      `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query: SEARCH_ORDERS_QUERY, variables}),
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[OrderSearch] API error ${response.status} (${store.shopDomain}):`, errText);
    throw new Error(`Shopify API error ${response.status} (${store.shopDomain})`);
  }

  const json = await response.json();
  if (json?.errors) {
    console.error(`[OrderSearch] GraphQL errors (${store.shopDomain}):`, JSON.stringify(json.errors));
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }

  const ordersData = json?.data?.orders;
  const orders = (ordersData?.edges || []).map(({node}) => {
    const numericId = node.id.split('/').pop();
    return {
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      total: node.totalPriceSet?.shopMoney?.amount || '0.00',
      baseCost: node.subtotalPriceSet?.shopMoney?.amount || '0.00',
      tax: node.totalTaxSet?.shopMoney?.amount || '0.00',
      fee: node.totalShippingPriceSet?.shopMoney?.amount || '0.00',
      currency: node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
      fulfillmentStatus: node.displayFulfillmentStatus || 'UNFULFILLED',
      financialStatus: node.displayFinancialStatus || 'PENDING',
      customer: {
        name:
          [node.customer?.firstName, node.customer?.lastName].filter(Boolean).join(' ') || 'N/A',
        email: node.customer?.email || ''
      },
      adminUrl: `https://${store.shopDomain}.myshopify.com/admin/orders/${numericId}`
    };
  });

  return {
    orders,
    pageInfo: ordersData?.pageInfo || {hasNextPage: false, endCursor: null},
    storeId: store.id,
    storeName: store.name,
    shopDomain: store.shopDomain
  };
}

/**
 * GET /api/analytics/order-search?storeId=xxx&query=...&cursor=...
 * Search orders via Shopify GraphQL Admin API (single store).
 */
export async function searchOrders(req, res) {
  try {
    const {storeId, query, cursor} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }
    if (!query || !query.trim()) {
      return res.json({
        success: true,
        data: {orders: [], pageInfo: {hasNextPage: false, endCursor: null}}
      });
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
    }

    const sanitizedQuery = sanitizeKeyword(query);

    const result = await fetchOrdersFromStore(store, sanitizedQuery, {
      cursor: cursor || null,
      limit: 25,
      timeoutMs: 10000
    });

    return res.json({
      success: true,
      data: {
        orders: result.orders,
        pageInfo: result.pageInfo,
        store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
      }
    });
  } catch (error) {
    console.error('Order search error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/analytics/order-details?storeId=xxx&orderId=gid://shopify/Order/123
 * Fetch full order details for the Shopify-like View Details modal.
 */
export async function getOrderDetails(req, res) {
  try {
    const {storeId, orderId} = req.query;
    if (!storeId || !orderId) {
      return res.status(400).json({success: false, error: 'storeId and orderId are required'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
    }

    // Accept either full GID or numeric id
    const gid = String(orderId).startsWith('gid://')
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    const response = await fetch(
      `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query: ORDER_DETAILS_QUERY, variables: {id: gid}})
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[OrderDetails] API error ${response.status}:`, errText);
      return res.status(502).json({success: false, error: `Shopify API error ${response.status}`});
    }

    const json = await response.json();
    if (json?.errors) {
      return res.status(422).json({success: false, error: json.errors[0]?.message || 'GraphQL error'});
    }

    const o = json?.data?.order;
    if (!o) {
      return res.status(404).json({success: false, error: 'Order not found'});
    }

    const money = set => ({
      amount: set?.shopMoney?.amount || '0.00',
      currency: set?.shopMoney?.currencyCode || 'USD'
    });

    const numericId = o.id.split('/').pop();
    const details = {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      processedAt: o.processedAt,
      note: o.note || '',
      tags: Array.isArray(o.tags) ? o.tags : [],
      fulfillmentStatus: o.displayFulfillmentStatus || 'UNFULFILLED',
      financialStatus: o.displayFinancialStatus || 'PENDING',
      totals: {
        subtotal: money(o.subtotalPriceSet),
        shipping: money(o.totalShippingPriceSet),
        tax: money(o.totalTaxSet),
        discount: money(o.totalDiscountsSet),
        refunded: money(o.totalRefundedSet),
        total: money(o.totalPriceSet)
      },
      customer: o.customer
        ? {
            name: [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || 'N/A',
            email: o.customer.email || '',
            phone: o.customer.phone || ''
          }
        : null,
      shippingAddress: o.shippingAddress || null,
      billingAddress: o.billingAddress || null,
      lineItems: (o.lineItems?.edges || []).map(({node}) => ({
        id: node.id,
        title: node.title,
        variantTitle: node.variantTitle || '',
        sku: node.sku || '',
        quantity: node.quantity,
        image: node.image?.url || null,
        unitPrice: money(node.originalUnitPriceSet),
        discountedUnitPrice: money(node.discountedUnitPriceSet)
      })),
      fulfillments: (o.fulfillments || []).map(f => ({
        status: f.status,
        createdAt: f.createdAt,
        tracking: (f.trackingInfo || []).map(t => ({
          number: t.number,
          url: t.url,
          company: t.company
        }))
      })),
      adminUrl: `https://${store.shopDomain}.myshopify.com/admin/orders/${numericId}`,
      store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
    };

    return res.json({success: true, data: details});
  } catch (error) {
    console.error('Order details error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

const UPDATE_ORDER_NOTE_MUTATION = `
mutation OrderUpdateNote($input: OrderInput!) {
  orderUpdate(input: $input) {
    order { id note }
    userErrors { field message }
  }
}`;

/**
 * PUT /api/analytics/order-note
 * Body: { storeId, orderId, note }
 * Update the note field on a Shopify order.
 */
export async function updateOrderNote(req, res) {
  try {
    const {storeId, orderId, note} = req.body || {};
    if (!storeId || !orderId) {
      return res.status(400).json({success: false, error: 'storeId and orderId are required'});
    }
    if (String(note || '').length > 5000) {
      return res.status(400).json({success: false, error: 'Note must be 5000 characters or less'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
    }

    const gid = String(orderId).startsWith('gid://')
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    const response = await fetch(
      `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: UPDATE_ORDER_NOTE_MUTATION,
          variables: {input: {id: gid, note: String(note || '')}}
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[UpdateOrderNote] API error ${response.status}:`, errText);
      return res.status(502).json({success: false, error: `Shopify API error ${response.status}`});
    }

    const json = await response.json();
    if (json?.errors) {
      return res.status(422).json({success: false, error: json.errors[0]?.message || 'GraphQL error'});
    }
    const userErrors = json?.data?.orderUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      return res.status(422).json({success: false, error: userErrors[0].message});
    }

    return res.json({
      success: true,
      data: {note: json?.data?.orderUpdate?.order?.note || ''}
    });
  } catch (error) {
    console.error('Update order note error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/analytics/customer-search?query=...&limit=10
 * Fan-out search for orders by customer email/name across ALL permitted stores.
 */
export async function searchCustomersAcrossStores(req, res) {
  try {
    const {query, limit} = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({success: false, error: 'query must be at least 2 characters'});
    }

    const perStoreLimit = Math.min(parseInt(limit, 10) || 10, 50);
    const keyword = sanitizeKeyword(query);

    if (!keyword) {
      return res.json({success: true, data: {orders: [], totalStores: 0, failedStores: [], warnings: []}});
    }

    // Auto-detect: email field vs full-text (name/email/order name)
    // Requires at least user@domain pattern to trigger email search
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(keyword);
    const shopifyQuery = looksLikeEmail
      ? `email:*${keyword}*`
      : keyword;

    // Load permitted stores
    const isAdmin = req.userRole === 'admin';
    let stores;
    if (isAdmin) {
      stores = await storeRepo.getAll();
    } else {
      const userRecord = await adminUserRepo.getById(req.userId);
      const assignedIds = extractStoreIds(userRecord?.assignedStores);
      stores = assignedIds.length > 0 ? await storeRepo.getByIds(assignedIds) : [];
    }

    const activeStores = stores.filter(s => s.status === 'active' && s.accessToken);

    if (activeStores.length === 0) {
      return res.json({success: true, data: {orders: [], totalStores: 0, failedStores: [], warnings: []}});
    }

    // Fan-out with Promise.allSettled — a single store failure must not crash the rest
    const settled = await Promise.allSettled(
      activeStores.map(s =>
        fetchOrdersFromStore(s, shopifyQuery, {cursor: null, limit: perStoreLimit, timeoutMs: 5000})
      )
    );

    const orders = [];
    const failedStores = [];

    settled.forEach((r, idx) => {
      const store = activeStores[idx];
      if (r.status === 'fulfilled') {
        for (const o of r.value.orders) {
          orders.push({
            ...o,
            store: {id: r.value.storeId, name: r.value.storeName, shopDomain: r.value.shopDomain}
          });
        }
      } else {
        failedStores.push({
          storeId: store.id,
          name: store.name,
          shopDomain: store.shopDomain,
          error: r.reason?.message || 'Unknown error'
        });
      }
    });

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      success: true,
      data: {
        orders,
        totalStores: activeStores.length,
        failedStores,
        warnings: failedStores.map(f => `${f.name || f.shopDomain}: ${f.error}`)
      }
    });
  } catch (error) {
    console.error('Customer search error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
