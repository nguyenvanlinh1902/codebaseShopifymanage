import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('customers');

/**
 * Create or update a customer from Shopify data
 *
 * @param {Object} data - Customer data from Shopify
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.shopifyId - Shopify customer ID
 * @param {string} data.email - Customer email
 * @param {string} [data.phone] - Customer phone
 * @param {string} data.firstName - First name
 * @param {string} data.lastName - Last name
 * @param {number} [data.totalOrders=0] - Total orders
 * @param {number} [data.totalSpent=0] - Total spent
 * @param {string} [data.currency='USD'] - Currency code
 * @param {Date|string} [data.createdAtShopify] - Customer created date in Shopify
 * @returns {Promise<Customer>}
 */
export async function upsertByShopifyId(data) {
  const now = FieldValue.serverTimestamp();
  const normalizedEmail = data.email ? data.email.toLowerCase().trim() : null;

  // Check if customer exists
  const existing = await getByShopifyId(data.organizationId, data.shopifyId);

  if (existing) {
    // Update existing customer
    const updateData = {
      email: normalizedEmail,
      phone: data.phone || null,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      totalOrders: data.totalOrders ?? existing.totalOrders,
      totalSpent: data.totalSpent ?? existing.totalSpent,
      currency: data.currency || existing.currency,
      averageOrderValue:
        data.totalOrders > 0 ? (data.totalSpent || 0) / data.totalOrders : existing.averageOrderValue,
      syncedAt: now,
      updatedAt: now
    };

    await collection.doc(existing.id).update(updateData);
    return getById(existing.id);
  }

  // Create new customer
  const customerData = {
    organizationId: data.organizationId,
    shopifyId: data.shopifyId,
    email: normalizedEmail,
    phone: data.phone || null,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    totalOrders: data.totalOrders || 0,
    totalSpent: data.totalSpent || 0,
    currency: data.currency || 'USD',
    averageOrderValue: data.totalOrders > 0 ? (data.totalSpent || 0) / data.totalOrders : 0,
    createdAtShopify: data.createdAtShopify || now,
    syncedAt: now,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(customerData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get customer by ID
 *
 * @param {string} id - Customer ID
 * @returns {Promise<Customer|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get customer by Shopify ID within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} shopifyId - Shopify customer ID
 * @returns {Promise<Customer|null>}
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
 * Get customer by email within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} email - Customer email
 * @returns {Promise<Customer|null>}
 */
export async function getByEmail(organizationId, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get customer by phone within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} phone - Customer phone
 * @returns {Promise<Customer|null>}
 */
export async function getByPhone(organizationId, phone) {
  // Normalize phone (remove spaces, dashes, etc.)
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('phone', '==', normalizedPhone)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Match customer by email or phone (for ticket creation)
 *
 * @param {string} organizationId - Organization ID
 * @param {string} [email] - Customer email
 * @param {string} [phone] - Customer phone
 * @returns {Promise<Customer|null>}
 */
export async function matchCustomer(organizationId, email, phone) {
  // 1. Try exact email match
  if (email) {
    const byEmail = await getByEmail(organizationId, email);
    if (byEmail) {
      return byEmail;
    }
  }

  // 2. Try phone match
  if (phone) {
    const byPhone = await getByPhone(organizationId, phone);
    if (byPhone) {
      return byPhone;
    }
  }

  return null;
}

/**
 * List customers by organization with pagination
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {PaginationQuery} [params.query={}] - Pagination options
 * @returns {Promise<PaginationResult<Customer>>}
 */
export async function listByOrganization({organizationId, query = {}}) {
  let queriedRef = collection.where('organizationId', '==', organizationId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAt_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Search customers by email or name
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Customer[]>}
 */
export async function search(organizationId, searchTerm, limit = 20) {
  const normalizedTerm = searchTerm.toLowerCase().trim();

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
 * Update customer statistics (called after order sync)
 *
 * @param {string} id - Customer ID
 * @param {number} totalOrders - New total orders
 * @param {number} totalSpent - New total spent
 * @returns {Promise<Customer>}
 */
export async function updateStats(id, totalOrders, totalSpent) {
  const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  await collection.doc(id).update({
    totalOrders,
    totalSpent,
    averageOrderValue,
    syncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return getById(id);
}

/**
 * Delete customer (for data cleanup)
 *
 * @param {string} id - Customer ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

/**
 * Count customers by organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>}
 */
export async function countByOrganization(organizationId) {
  const snapshot = await collection.where('organizationId', '==', organizationId).count().get();
  return snapshot.data().count;
}

export {collection, firestore};
