import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('orders');

/**
 * Create or update an order from Shopify data
 *
 * @param {Object} data - Order data from Shopify
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.customerId - Customer ID (internal)
 * @param {string} data.shopifyId - Shopify order ID
 * @param {string} data.orderNumber - Order number
 * @param {string} data.email - Customer email
 * @param {number} data.totalPrice - Total price
 * @param {string} data.currency - Currency code
 * @param {string} data.financialStatus - Payment status
 * @param {string} data.fulfillmentStatus - Fulfillment status
 * @param {Array<OrderLineItem>} data.lineItems - Line items
 * @param {ShippingAddress} [data.shippingAddress] - Shipping address
 * @param {Array<TrackingInfo>} [data.trackingInfo] - Tracking info
 * @param {Date|string} [data.createdAtShopify] - Order created date in Shopify
 * @returns {Promise<Order>}
 */
export async function upsertByShopifyId(data) {
  const now = FieldValue.serverTimestamp();

  // Check if order exists
  const existing = await getByShopifyId(data.organizationId, data.shopifyId);

  if (existing) {
    // Update existing order
    const updateData = {
      customerId: data.customerId || existing.customerId,
      email: data.email ? data.email.toLowerCase().trim() : existing.email,
      totalPrice: data.totalPrice ?? existing.totalPrice,
      financialStatus: data.financialStatus || existing.financialStatus,
      fulfillmentStatus: data.fulfillmentStatus || existing.fulfillmentStatus,
      lineItems: data.lineItems || existing.lineItems,
      shippingAddress: data.shippingAddress || existing.shippingAddress,
      trackingInfo: data.trackingInfo || existing.trackingInfo,
      syncedAt: now,
      updatedAt: now
    };

    await collection.doc(existing.id).update(updateData);
    return getById(existing.id);
  }

  // Create new order
  const orderData = {
    organizationId: data.organizationId,
    customerId: data.customerId,
    shopifyId: data.shopifyId,
    orderNumber: data.orderNumber,
    email: data.email ? data.email.toLowerCase().trim() : null,
    totalPrice: data.totalPrice || 0,
    currency: data.currency || 'USD',
    financialStatus: data.financialStatus || 'pending',
    fulfillmentStatus: data.fulfillmentStatus || null,
    lineItems: data.lineItems || [],
    shippingAddress: data.shippingAddress || null,
    trackingInfo: data.trackingInfo || [],
    createdAtShopify: data.createdAtShopify || now,
    syncedAt: now,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(orderData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get order by ID
 *
 * @param {string} id - Order ID
 * @returns {Promise<Order|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get order by Shopify ID within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} shopifyId - Shopify order ID
 * @returns {Promise<Order|null>}
 */
export async function getByShopifyId(organizationId, shopifyId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('shopifyId', '==', shopifyId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get order by order number within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} orderNumber - Order number
 * @returns {Promise<Order|null>}
 */
export async function getByOrderNumber(organizationId, orderNumber) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('orderNumber', '==', orderNumber)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * List orders by customer with pagination
 *
 * @param {string} customerId - Customer ID
 * @param {PaginationQuery} [query={}] - Pagination options
 * @returns {Promise<PaginationResult<Order>>}
 */
export async function listByCustomer(customerId, query = {}) {
  let queriedRef = collection.where('customerId', '==', customerId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAtShopify_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Get all orders for a customer (for sidebar display)
 *
 * @param {string} customerId - Customer ID
 * @param {number} [limit=10] - Max orders to return
 * @returns {Promise<Order[]>}
 */
export async function getAllByCustomer(customerId, limit = 10) {
  const snapshot = await collection
    .where('customerId', '==', customerId)
    .orderBy('createdAtShopify', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * List orders by organization with pagination
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {PaginationQuery} [params.query={}] - Pagination options
 * @returns {Promise<PaginationResult<Order>>}
 */
export async function listByOrganization({organizationId, query = {}}) {
  let queriedRef = collection.where('organizationId', '==', organizationId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAtShopify_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Update order tracking information
 *
 * @param {string} id - Order ID
 * @param {Array<TrackingInfo>} trackingInfo - Updated tracking info
 * @returns {Promise<Order>}
 */
export async function updateTrackingInfo(id, trackingInfo) {
  await collection.doc(id).update({
    trackingInfo,
    syncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return getById(id);
}

/**
 * Update order fulfillment status
 *
 * @param {string} id - Order ID
 * @param {string} fulfillmentStatus - New fulfillment status
 * @param {Array<TrackingInfo>} [trackingInfo] - Optional tracking info
 * @returns {Promise<Order>}
 */
export async function updateFulfillmentStatus(id, fulfillmentStatus, trackingInfo) {
  const updateData = {
    fulfillmentStatus,
    syncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  if (trackingInfo) {
    updateData.trackingInfo = trackingInfo;
  }

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Search orders by email or order number
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Order[]>}
 */
export async function search(organizationId, searchTerm, limit = 20) {
  const normalizedTerm = searchTerm.toLowerCase().trim();

  // Try order number match first
  const byNumber = await getByOrderNumber(organizationId, normalizedTerm);
  if (byNumber) {
    return [byNumber];
  }

  // Search by email prefix
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('email', '>=', normalizedTerm)
    .where('email', '<=', normalizedTerm + '\uf8ff')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Delete order (for data cleanup)
 *
 * @param {string} id - Order ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

/**
 * Delete all orders for a customer
 *
 * @param {string} customerId - Customer ID
 * @returns {Promise<number>} Number of deleted orders
 */
export async function deleteByCustomer(customerId) {
  const snapshot = await collection.where('customerId', '==', customerId).get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  return snapshot.size;
}

/**
 * Count orders by organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>}
 */
export async function countByOrganization(organizationId) {
  const snapshot = await collection.where('organizationId', '==', organizationId).count().get();
  return snapshot.data().count;
}

export {collection, firestore};
