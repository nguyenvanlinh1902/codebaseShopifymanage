import * as customerRepository from '@functions/repositories/customerRepository';
import * as orderRepository from '@functions/repositories/orderRepository';
import * as organizationRepository from '@functions/repositories/organizationRepository';
import {decrypt} from '@functions/helpers/encryption';
import Shopify from 'shopify-api-node';

/**
 * Create Shopify API client for an organization
 *
 * @param {Organization} organization - Organization with Shopify token
 * @returns {Shopify}
 */
function createShopifyClient(organization) {
  if (!organization.shopifyToken) {
    throw new Error('Shopify not connected');
  }

  const accessToken = decrypt(organization.shopifyToken);
  if (!accessToken) {
    throw new Error('Failed to decrypt Shopify token');
  }

  return new Shopify({
    shopName: organization.shopifyDomain.replace('.myshopify.com', ''),
    accessToken,
    apiVersion: '2025-01'
  });
}

/**
 * Sync a customer from Shopify webhook
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} shopifyCustomer - Shopify customer data
 * @returns {Promise<Customer>}
 */
export async function syncCustomer(organizationId, shopifyCustomer) {
  return customerRepository.upsertByShopifyId({
    organizationId,
    shopifyId: shopifyCustomer.id.toString(),
    email: shopifyCustomer.email,
    phone: shopifyCustomer.phone,
    firstName: shopifyCustomer.first_name,
    lastName: shopifyCustomer.last_name,
    totalOrders: shopifyCustomer.orders_count || 0,
    totalSpent: parseFloat(shopifyCustomer.total_spent) || 0,
    currency: shopifyCustomer.currency || 'USD',
    createdAtShopify: shopifyCustomer.created_at
  });
}

/**
 * Sync an order from Shopify webhook
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} shopifyOrder - Shopify order data
 * @returns {Promise<Order>}
 */
export async function syncOrder(organizationId, shopifyOrder) {
  // Find or create customer
  let customer = null;
  if (shopifyOrder.customer) {
    customer = await syncCustomer(organizationId, shopifyOrder.customer);
  } else if (shopifyOrder.email) {
    customer = await customerRepository.getByEmail(organizationId, shopifyOrder.email);
  }

  // Parse line items
  const lineItems = (shopifyOrder.line_items || []).map(item => ({
    shopifyId: item.id.toString(),
    title: item.title,
    variantTitle: item.variant_title,
    quantity: item.quantity,
    price: parseFloat(item.price),
    imageUrl: item.image?.src || null,
    sku: item.sku
  }));

  // Parse shipping address
  const shippingAddress = shopifyOrder.shipping_address
    ? {
        name: shopifyOrder.shipping_address.name,
        address1: shopifyOrder.shipping_address.address1,
        address2: shopifyOrder.shipping_address.address2,
        city: shopifyOrder.shipping_address.city,
        province: shopifyOrder.shipping_address.province,
        provinceCode: shopifyOrder.shipping_address.province_code,
        country: shopifyOrder.shipping_address.country,
        countryCode: shopifyOrder.shipping_address.country_code,
        zip: shopifyOrder.shipping_address.zip,
        phone: shopifyOrder.shipping_address.phone
      }
    : null;

  // Parse tracking info from fulfillments
  const trackingInfo = [];
  if (shopifyOrder.fulfillments) {
    for (const fulfillment of shopifyOrder.fulfillments) {
      if (fulfillment.tracking_number) {
        trackingInfo.push({
          number: fulfillment.tracking_number,
          carrier: fulfillment.tracking_company || 'Unknown',
          url: fulfillment.tracking_url || null,
          status: fulfillment.shipment_status || fulfillment.status
        });
      }
    }
  }

  return orderRepository.upsertByShopifyId({
    organizationId,
    customerId: customer?.id || null,
    shopifyId: shopifyOrder.id.toString(),
    orderNumber: shopifyOrder.name || shopifyOrder.order_number?.toString(),
    email: shopifyOrder.email,
    totalPrice: parseFloat(shopifyOrder.total_price),
    currency: shopifyOrder.currency,
    financialStatus: shopifyOrder.financial_status,
    fulfillmentStatus: shopifyOrder.fulfillment_status,
    lineItems,
    shippingAddress,
    trackingInfo,
    createdAtShopify: shopifyOrder.created_at
  });
}

/**
 * Sync fulfillment update from webhook
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} fulfillmentData - Shopify fulfillment data
 * @returns {Promise<Order|null>}
 */
export async function syncFulfillment(organizationId, fulfillmentData) {
  // Find the order
  const orderId = fulfillmentData.order_id?.toString();
  if (!orderId) {
    return null;
  }

  const order = await orderRepository.getByShopifyId(organizationId, orderId);
  if (!order) {
    return null;
  }

  // Update tracking info
  const trackingInfo = order.trackingInfo || [];

  // Check if this tracking already exists
  const existingIndex = trackingInfo.findIndex(t => t.number === fulfillmentData.tracking_number);

  const newTracking = {
    number: fulfillmentData.tracking_number,
    carrier: fulfillmentData.tracking_company || 'Unknown',
    url: fulfillmentData.tracking_url || null,
    status: fulfillmentData.shipment_status || fulfillmentData.status
  };

  if (existingIndex >= 0) {
    trackingInfo[existingIndex] = newTracking;
  } else if (fulfillmentData.tracking_number) {
    trackingInfo.push(newTracking);
  }

  return orderRepository.updateFulfillmentStatus(order.id, fulfillmentData.status || 'fulfilled', trackingInfo);
}

/**
 * Perform initial sync of customers and orders
 * Called after Shopify OAuth connection
 *
 * @param {string} organizationId - Organization ID
 * @param {Function} [progressCallback] - Optional callback for progress updates
 * @returns {Promise<{customers: number, orders: number}>}
 */
export async function performInitialSync(organizationId, progressCallback) {
  const organization = await organizationRepository.getById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const shopify = createShopifyClient(organization);

  // Calculate date 90 days ago
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  let customerCount = 0;
  let orderCount = 0;

  // Sync orders (which include customer data)
  let params = {
    created_at_min: sinceDate.toISOString(),
    limit: 250,
    status: 'any'
  };

  let hasMore = true;
  while (hasMore) {
    const orders = await shopify.order.list(params);

    for (const order of orders) {
      await syncOrder(organizationId, order);
      orderCount++;

      if (progressCallback) {
        progressCallback({type: 'order', count: orderCount});
      }
    }

    // Check for pagination
    if (orders.length < params.limit) {
      hasMore = false;
    } else {
      // Get next page using since_id
      params.since_id = orders[orders.length - 1].id;
    }
  }

  // Sync customers who may not have orders
  params = {
    created_at_min: sinceDate.toISOString(),
    limit: 250
  };

  hasMore = true;
  while (hasMore) {
    const customers = await shopify.customer.list(params);

    for (const customer of customers) {
      // Check if already synced via order
      const existing = await customerRepository.getByShopifyId(organizationId, customer.id.toString());
      if (!existing) {
        await syncCustomer(organizationId, customer);
        customerCount++;

        if (progressCallback) {
          progressCallback({type: 'customer', count: customerCount});
        }
      }
    }

    if (customers.length < params.limit) {
      hasMore = false;
    } else {
      params.since_id = customers[customers.length - 1].id;
    }
  }

  // Update onboarding status
  await organizationRepository.updateOnboardingStatus(organizationId, {
    shopifyConnected: true
  });

  return {customers: customerCount, orders: orderCount};
}

/**
 * Verify Shopify webhook HMAC
 *
 * @param {string} rawBody - Raw request body
 * @param {string} hmacHeader - X-Shopify-Hmac-Sha256 header
 * @param {string} secret - Shopify webhook secret
 * @returns {boolean}
 */
export function verifyShopifyWebhook(rawBody, hmacHeader, secret) {
  const crypto = require('crypto');
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}
