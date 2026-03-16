/**
 * Shopify Fulfillment Service — tracking updates and fulfillment creation via GraphQL.
 */
import {toGid, fromGid} from './shopify-helpers.js';

/**
 * Add tracking to order — updates existing fulfillment or creates a new one.
 */
export async function addOrderTracking(shopify, orderId, trackingInfo) {
  try {
    const orderGid = toGid('Order', orderId);
    const query = `query($id: ID!) {
      order(id: $id) {
        fulfillments(first: 5) { id status }
      }
    }`;
    const res = await shopify.graphql(query, {id: orderGid});
    const fulfillments = res?.order?.fulfillments || [];

    if (fulfillments.length > 0) {
      const fulfillmentId = fromGid(fulfillments[0].id);
      return await updateFulfillmentTracking(shopify, orderId, fulfillmentId, trackingInfo);
    }
    return await createFulfillment(shopify, orderId, trackingInfo);
  } catch (error) {
    console.error('Error adding order tracking:', error);
    throw new Error(`Failed to add order tracking: ${error.message}`);
  }
}

/**
 * Update fulfillment tracking via GraphQL fulfillmentTrackingInfoUpdate.
 */
export async function updateFulfillmentTracking(shopify, orderId, fulfillmentId, trackingInfo) {
  try {
    const mutation = `mutation fulfillmentTrackingInfoUpdate(
      $fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!, $notifyCustomer: Boolean
    ) {
      fulfillmentTrackingInfoUpdate(
        fulfillmentId: $fulfillmentId, trackingInfoInput: $trackingInfoInput, notifyCustomer: $notifyCustomer
      ) {
        fulfillment { id status }
        userErrors { field message }
      }
    }`;

    const result = await shopify.graphql(mutation, {
      fulfillmentId: toGid('Fulfillment', fulfillmentId),
      trackingInfoInput: {
        number: trackingInfo.trackingNumber,
        company: trackingInfo.trackingCompany,
        url: trackingInfo.trackingUrl
      },
      notifyCustomer: true
    });

    if (result.fulfillmentTrackingInfoUpdate.userErrors?.length > 0) {
      throw new Error(result.fulfillmentTrackingInfoUpdate.userErrors[0].message);
    }
    return result.fulfillmentTrackingInfoUpdate.fulfillment;
  } catch (error) {
    console.error('Error updating fulfillment tracking:', error);
    throw new Error(`Failed to update tracking: ${error.message}`);
  }
}

/**
 * Create a new fulfillment with tracking via GraphQL fulfillmentCreate.
 * Queries fulfillment orders first to get open line items.
 */
export async function createFulfillment(shopify, orderId, trackingInfo) {
  try {
    const orderGid = toGid('Order', orderId);
    const foQuery = `query orderFulfillmentOrders($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 10) {
          edges {
            node {
              id status
              lineItems(first: 100) {
                edges { node { id remainingQuantity } }
              }
            }
          }
        }
      }
    }`;

    const foResult = await shopify.graphql(foQuery, {id: orderGid});
    const fulfillmentOrders = foResult.order.fulfillmentOrders.edges.map(e => e.node);
    const openOrders = fulfillmentOrders.filter(
      fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS'
    );

    if (openOrders.length === 0) throw new Error('No open fulfillment orders found');

    const lineItemsByFulfillmentOrder = openOrders.map(fo => ({
      fulfillmentOrderId: fo.id,
      fulfillmentOrderLineItems: fo.lineItems.edges
        .filter(e => e.node.remainingQuantity > 0)
        .map(e => ({id: e.node.id, quantity: e.node.remainingQuantity}))
    }));

    const mutation = `mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id status }
        userErrors { field message }
      }
    }`;

    const result = await shopify.graphql(mutation, {
      fulfillment: {
        lineItemsByFulfillmentOrder,
        trackingInfo: {
          number: trackingInfo.trackingNumber,
          company: trackingInfo.trackingCompany,
          url: trackingInfo.trackingUrl
        },
        notifyCustomer: true
      }
    });

    if (result.fulfillmentCreate.userErrors?.length > 0) {
      throw new Error(result.fulfillmentCreate.userErrors[0].message);
    }
    return result.fulfillmentCreate.fulfillment;
  } catch (error) {
    console.error('Error creating fulfillment:', error);
    throw new Error(`Failed to create fulfillment: ${error.message}`);
  }
}

/**
 * Get fulfilled orders with tracking info via GraphQL (auto-paginated up to maxPages).
 */
export async function getOrdersWithFulfillments(
  shopify,
  {first = 25, maxPages = 5, query = 'fulfillment_status:shipped'} = {}
) {
  const gqlQuery = `query GetFulfilledOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id name createdAt displayFulfillmentStatus
          fulfillments {
            trackingInfo { number company url }
            status createdAt
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const allOrders = [];
  let after = null;

  for (let page = 0; page < maxPages; page++) {
    const result = await shopify.graphql(gqlQuery, {first, after, query});
    const edges = result.orders.edges || [];
    const orders = edges
      .map(e => e.node)
      .filter(o => o.fulfillments?.some(f => f.trackingInfo?.some(t => t.number)));

    allOrders.push(...orders);
    if (!result.orders.pageInfo.hasNextPage) break;
    after = result.orders.pageInfo.endCursor;
  }

  return allOrders;
}
