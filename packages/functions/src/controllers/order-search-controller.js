import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

const SEARCH_ORDERS_QUERY = `
query SearchOrders($query: String!, $first: Int!, $after: String) {
  orders(query: $query, first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        displayFulfillmentStatus
        displayFinancialStatus
        customer { firstName lastName email }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * GET /api/analytics/order-search?storeId=xxx&query=...&cursor=...
 * Search orders via Shopify GraphQL Admin API.
 */
export async function searchOrders(req, res) {
  try {
    const {storeId, query, cursor} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }
    if (!query || !query.trim()) {
      return res.json({success: true, data: {orders: [], pageInfo: {hasNextPage: false, endCursor: null}}});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    // Sanitize query — escape quotes to prevent GraphQL injection
    const sanitizedQuery = query.replace(/[\\"/]/g, ' ').trim();

    const variables = {query: sanitizedQuery, first: 25, after: cursor || null};

    const response = await fetch(
      `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query: SEARCH_ORDERS_QUERY, variables})
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[OrderSearch] API error ${response.status}:`, errText);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const json = await response.json();
    if (json?.errors) {
      console.error('[OrderSearch] GraphQL errors:', JSON.stringify(json.errors));
      return res.status(422).json({success: false, error: json.errors[0]?.message || 'GraphQL error'});
    }

    const ordersData = json?.data?.orders;
    const orders = (ordersData?.edges || []).map(({node}) => {
      // Extract numeric ID from GID for admin URL
      const numericId = node.id.split('/').pop();
      return {
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        total: node.totalPriceSet?.shopMoney?.amount || '0.00',
        currency: node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
        fulfillmentStatus: node.displayFulfillmentStatus || 'UNFULFILLED',
        financialStatus: node.displayFinancialStatus || 'PENDING',
        customer: {
          name: [node.customer?.firstName, node.customer?.lastName].filter(Boolean).join(' ') || 'N/A',
          email: node.customer?.email || ''
        },
        adminUrl: `https://${store.shopDomain}.myshopify.com/admin/orders/${numericId}`
      };
    });

    return res.json({
      success: true,
      data: {
        orders,
        pageInfo: ordersData?.pageInfo || {hasNextPage: false, endCursor: null},
        store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
      }
    });
  } catch (error) {
    console.error('Order search error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
