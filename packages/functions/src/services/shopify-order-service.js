/**
 * Shopify Order Service — order read operations via GraphQL.
 * Fulfillment mutations live in shopify-fulfillment-service.js.
 */
import {toGid, fromGid} from './shopify-helpers.js';
import {
  addOrderTracking,
  updateFulfillmentTracking,
  createFulfillment,
  getOrdersWithFulfillments
} from './shopify-fulfillment-service.js';

export {addOrderTracking, updateFulfillmentTracking, createFulfillment, getOrdersWithFulfillments};

/** Map GraphQL order node to snake_case shape (backward compat with formatOrderRowsForSheet). */
function mapOrderNode(node) {
  return {
    id: fromGid(node.id).toString(),
    name: node.name,
    email: node.email || '',
    created_at: node.createdAt,
    note: node.note || '',
    payment_gateway_names: node.paymentGatewayNames || [],
    total_price: node.currentTotalPriceSet?.shopMoney?.amount || '0',
    total_tax: node.currentTotalTaxSet?.shopMoney?.amount || '0',
    shipping_address: node.shippingAddress
      ? {
          name: node.shippingAddress.name || '',
          first_name: node.shippingAddress.firstName || '',
          last_name: node.shippingAddress.lastName || '',
          address1: node.shippingAddress.address1 || '',
          address2: node.shippingAddress.address2 || '',
          city: node.shippingAddress.city || '',
          zip: node.shippingAddress.zip || '',
          province: node.shippingAddress.province || '',
          country_code: node.shippingAddress.countryCode || '',
          phone: node.shippingAddress.phone || ''
        }
      : null,
    line_items: (node.lineItems?.edges || []).map(e => ({
      id: fromGid(e.node.id).toString(),
      name: e.node.title,
      sku: e.node.sku || '',
      quantity: e.node.quantity,
      price: e.node.originalUnitPriceSet?.shopMoney?.amount || '0',
      variant_id: e.node.variant ? fromGid(e.node.variant.id) : null,
      properties: (e.node.customAttributes || []).map(a => ({name: a.key, value: a.value}))
    }))
  };
}

/** Map REST-style status param to GraphQL query string. */
function statusToQuery(status, nameFilter, createdAtMin, createdAtMax) {
  const statusMap = {open: 'status:open', closed: 'status:closed', cancelled: 'status:cancelled', any: ''};
  const parts = [];
  if (status && statusMap[status] !== undefined && statusMap[status]) parts.push(statusMap[status]);
  if (nameFilter) parts.push(`name:${nameFilter}`);
  if (createdAtMin) parts.push(`created_at:>='${createdAtMin}'`);
  if (createdAtMax) parts.push(`created_at:<='${createdAtMax}'`);
  return parts.join(' ');
}

const GET_ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id name email createdAt note paymentGatewayNames
          currentTotalPriceSet { shopMoney { amount } }
          currentTotalTaxSet { shopMoney { amount } }
          shippingAddress {
            firstName lastName name address1 address2
            city zip province provinceCode countryCode phone
          }
          lineItems(first: 100) {
            edges {
              node {
                id title sku quantity
                originalUnitPriceSet { shopMoney { amount } }
                variant { id }
                customAttributes { key value }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/**
 * Get orders via GraphQL.
 * @param {object} shopify - shopify-api-node client
 * @param {object} params - { limit, status, cursor, name }
 * @returns {{ orders: object[], pageInfo: { hasNextPage: boolean, endCursor: string|null } }}
 */
export async function getOrders(shopify, params = {}) {
  try {
    const first = params.limit || 250;
    const after = params.cursor || null;
    const query = statusToQuery(params.status || 'any', params.name, params.createdAtMin, params.createdAtMax);

    const result = await shopify.graphql(GET_ORDERS_QUERY, {first, after, query});
    const orders = (result.orders.edges || []).map(e => mapOrderNode(e.node));
    const {pageInfo} = result.orders;

    return {orders, pageInfo: {hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor}};
  } catch (error) {
    console.error('Error getting orders:', error);
    throw new Error(`Failed to get orders: ${error.message}`);
  }
}

/**
 * Get single order by numeric ID via GraphQL.
 * Returns: { id (numeric), order_number, name, fulfillments }
 */
export async function getOrder(shopify, orderId) {
  try {
    const query = `query($id: ID!) {
      order(id: $id) {
        id name legacyResourceId
        fulfillments(first: 10) {
          id status
          trackingInfo { number company url }
        }
      }
    }`;

    const result = await shopify.graphql(query, {id: toGid('Order', orderId)});
    const order = result.order;
    if (!order) throw new Error(`Order ${orderId} not found`);

    return {
      id: fromGid(order.id),
      order_number: order.name.replace('#', ''),
      name: order.name,
      fulfillments: (order.fulfillments || []).map(f => ({
        id: fromGid(f.id),
        status: f.status,
        tracking_info: f.trackingInfo || []
      }))
    };
  } catch (error) {
    console.error('Error getting order:', error);
    throw new Error(`Failed to get order: ${error.message}`);
  }
}

/**
 * Get order by order number (e.g., #1001 or 1001) via GraphQL.
 * Returns {id (numeric), gid, name} or null if not found.
 */
export async function getOrderByNumber(shopify, orderNumber) {
  try {
    const cleanNumber = orderNumber.toString().replace(/^#/, '');
    const query = `query($q: String!) {
      orders(first: 1, query: $q) {
        edges { node { id name } }
      }
    }`;
    for (const name of [cleanNumber, `#${cleanNumber}`]) {
      const res = await shopify.graphql(query, {q: `name:${name}`});
      const node = res?.orders?.edges?.[0]?.node;
      if (node) return {id: fromGid(node.id), gid: node.id, name: node.name};
    }
    return null;
  } catch (error) {
    console.error('Error getting order by number:', error);
    throw new Error(`Failed to get order by number: ${error.message}`);
  }
}
