/**
 * Order Operations Module
 * Handles all order-related Shopify API operations
 */

/**
 * Get orders from Shopify
 * @param {Object} params - Query parameters (status, limit, since_id, etc.)
 */
export async function getOrders(params = {}) {
  try {
    let queryParams;
    if (params.page_info) {
      // Cursor pagination: Shopify only allows page_info + limit, no other filters
      queryParams = {page_info: params.page_info};
      if (params.limit) queryParams.limit = params.limit;
    } else {
      queryParams = {limit: 250, status: 'any', ...params};
    }

    const orders = await this.shopify.order.list(queryParams);
    return orders;
  } catch (error) {
    console.error('Error getting orders:', error);
    throw new Error(`Failed to get orders: ${error.message}`);
  }
}

/**
 * Get all orders from Shopify with pagination
 * Uses since_id to paginate through all orders
 * @param {Object} params - Query parameters (created_at_min, status, etc.)
 */
export async function getAllOrders(params = {}) {
  try {
    const allOrders = [];
    let lastId = null;
    const limit = 250;

    while (true) {
      const queryParams = {limit, status: 'any', ...params};
      if (lastId) queryParams.since_id = lastId;

      const orders = await this.shopify.order.list(queryParams);
      if (orders.length === 0) break;

      allOrders.push(...orders);
      lastId = orders[orders.length - 1].id;

      if (orders.length < limit) break;
    }

    return allOrders;
  } catch (error) {
    console.error('Error getting all orders:', error);
    throw new Error(`Failed to get all orders: ${error.message}`);
  }
}

/**
 * Get order by ID
 */
export async function getOrder(orderId) {
  try {
    const order = await this.shopify.order.get(orderId);
    return order;
  } catch (error) {
    console.error('Error getting order:', error);
    throw new Error(`Failed to get order: ${error.message}`);
  }
}

/**
 * Get order by order number (e.g., #1001, 1001)
 */
export async function getOrderByNumber(orderNumber) {
  try {
    // Remove # prefix if present
    const cleanNumber = orderNumber.toString().replace(/^#/, '');

    // Search by name (order number)
    const orders = await this.shopify.order.list({
      name: cleanNumber,
      limit: 1
    });

    if (orders.length > 0) {
      return orders[0];
    }

    // Try with # prefix
    const ordersWithHash = await this.shopify.order.list({
      name: `#${cleanNumber}`,
      limit: 1
    });

    return ordersWithHash.length > 0 ? ordersWithHash[0] : null;
  } catch (error) {
    console.error('Error getting order by number:', error);
    throw new Error(`Failed to get order by number: ${error.message}`);
  }
}

/**
 * Add tracking information to order
 * Creates a new fulfillment or updates existing one
 */
export async function addOrderTracking(orderId, trackingInfo) {
  try {
    const order = await this.getOrder(orderId);

    // Check if order has existing fulfillments
    if (order.fulfillments && order.fulfillments.length > 0) {
      // Update first fulfillment
      const fulfillmentId = order.fulfillments[0].id;
      return await this.updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo);
    } else {
      // Create new fulfillment
      return await this.createFulfillment(orderId, trackingInfo);
    }
  } catch (error) {
    console.error('Error adding order tracking:', error);
    throw new Error(`Failed to add order tracking: ${error.message}`);
  }
}

/**
 * Update fulfillment with tracking info
 */
export async function updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo) {
  try {
    const result = await this.shopify.fulfillment.updateTracking(fulfillmentId, {
      tracking_info: {
        number: trackingInfo.trackingNumber,
        company: trackingInfo.trackingCompany,
        url: trackingInfo.trackingUrl
      },
      notify_customer: true
    });

    return result;
  } catch (error) {
    console.error('Error updating fulfillment tracking:', error);
    throw new Error(`Failed to update tracking: ${error.message}`);
  }
}

/**
 * Create a new fulfillment with tracking
 * Uses Fulfillment Orders API (legacy fulfillment endpoint returns 406)
 */
export async function createFulfillment(orderId, trackingInfo) {
  try {
    // Get fulfillment orders for this order
    const fulfillmentOrders = await this.shopify.order.fulfillmentOrders(orderId);

    // Find open/unfulfilled fulfillment orders
    const openOrders = fulfillmentOrders.filter(
      fo => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (openOrders.length === 0) {
      throw new Error('No open fulfillment orders found');
    }

    // Build line_items_by_fulfillment_order for createV2
    const lineItemsByFulfillmentOrder = openOrders.map(fo => ({
      fulfillment_order_id: fo.id,
      fulfillment_order_line_items: fo.line_items.map(li => ({
        id: li.id,
        quantity: li.fulfillable_quantity
      }))
    }));

    const fulfillment = await this.shopify.fulfillment.createV2({
      line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
      tracking_info: {
        number: trackingInfo.trackingNumber,
        company: trackingInfo.trackingCompany,
        url: trackingInfo.trackingUrl
      },
      notify_customer: true
    });

    return fulfillment;
  } catch (error) {
    console.error('Error creating fulfillment:', error);
    throw new Error(`Failed to create fulfillment: ${error.message}`);
  }
}
