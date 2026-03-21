/**
 * Shopify Fulfillment Service — tracking updates and fulfillment creation via GraphQL.
 */
import {toGid, fromGid} from './shopify-helpers.js';

/**
 * Add tracking to order.
 * @param {string} mode - 'add' creates new fulfillment (multi-pack), 'replace' updates existing.
 */
export async function addOrderTracking(shopify, orderId, trackingInfo, mode = 'add') {
  try {
    if (mode === 'replace') {
      const fulfillments = await getOrderFulfillments(shopify, orderId);
      if (fulfillments.length > 0) {
        const fulfillmentId = fromGid(fulfillments[0].id);
        return await updateFulfillmentTracking(shopify, orderId, fulfillmentId, trackingInfo);
      }
    }

    // Try creating a new fulfillment first (works when there are unfulfilled items)
    try {
      return await createFulfillment(shopify, orderId, trackingInfo);
    } catch (createErr) {
      // If no open fulfillment orders, append tracking to existing fulfillment
      if (createErr.message.includes('No open fulfillment orders')) {
        const fulfillments = await getOrderFulfillments(shopify, orderId);
        if (fulfillments.length > 0) {
          return await appendTrackingToFulfillment(shopify, fulfillments[0], trackingInfo);
        }
      }
      throw createErr;
    }
  } catch (error) {
    console.error('Error adding order tracking:', error);
    throw new Error(`Failed to add order tracking: ${error.message}`);
  }
}

/**
 * Get fulfillments with tracking info for an order.
 */
async function getOrderFulfillments(shopify, orderId) {
  const orderGid = toGid('Order', orderId);
  const query = `query($id: ID!) {
    order(id: $id) {
      fulfillments(first: 10) {
        id status
        trackingInfo { number company url }
      }
    }
  }`;
  const res = await shopify.graphql(query, {id: orderGid});
  return res?.order?.fulfillments || [];
}

/**
 * Append a new tracking number to an existing fulfillment using the numbers[] array.
 * Preserves existing tracking numbers and adds the new one.
 */
async function appendTrackingToFulfillment(shopify, fulfillment, trackingInfo) {
  const existingNumbers = (fulfillment.trackingInfo || []).map(t => t.number).filter(Boolean);
  const existingUrls = (fulfillment.trackingInfo || []).map(t => t.url).filter(Boolean);

  // Skip if tracking number already exists on this fulfillment
  if (existingNumbers.includes(trackingInfo.trackingNumber)) {
    console.log(`Tracking ${trackingInfo.trackingNumber} already exists on fulfillment, skipping`);
    return {id: fulfillment.id, status: fulfillment.status, skipped: true};
  }

  const allNumbers = [...existingNumbers, trackingInfo.trackingNumber];
  const allUrls = [...existingUrls, ...(trackingInfo.trackingUrl ? [trackingInfo.trackingUrl] : [])];

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

  const trackingInfoInput = {
    numbers: allNumbers,
    company: trackingInfo.trackingCompany || fulfillment.trackingInfo?.[0]?.company || 'Other'
  };
  if (allUrls.length > 0) trackingInfoInput.urls = allUrls;

  const result = await shopify.graphql(mutation, {
    fulfillmentId: fulfillment.id,
    trackingInfoInput,
    notifyCustomer: true
  });

  if (result.fulfillmentTrackingInfoUpdate.userErrors?.length > 0) {
    throw new Error(result.fulfillmentTrackingInfoUpdate.userErrors[0].message);
  }
  return result.fulfillmentTrackingInfoUpdate.fulfillment;
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

    const lineItemsByFulfillmentOrder = openOrders
      .map(fo => ({
        fulfillmentOrderId: fo.id,
        fulfillmentOrderLineItems: fo.lineItems.edges
          .filter(e => e.node.remainingQuantity > 0)
          .map(e => ({id: e.node.id, quantity: e.node.remainingQuantity}))
      }))
      .filter(fo => fo.fulfillmentOrderLineItems.length > 0);

    if (lineItemsByFulfillmentOrder.length === 0) {
      throw new Error('No open fulfillment orders found');
    }

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
