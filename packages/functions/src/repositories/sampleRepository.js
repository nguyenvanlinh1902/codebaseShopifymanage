import {Firestore, FieldValue} from '@google-cloud/firestore';
import {
  prepareDoc,
  paginateQuery,
  getOrderBy,
  getByIds,
  batchCreate,
  batchUpdate,
  batchDelete
} from './helper';

/**
 * @documentation
 *
 * Repository Pattern Guidelines:
 * - One repository connects to ONE collection only
 * - All queries MUST be scoped by shopId (multi-tenant)
 * - Use paginateQuery for list operations with pagination
 * - Use prepareDoc to format Firestore documents
 * - Return {success, data, error} for mutations
 * - Use batch operations for 500+ documents
 */

const firestore = new Firestore();
/** @type {CollectionReference} */
const collection = firestore.collection('samples');

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get a single document by ID
 * Always validate shopId ownership for security
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID for ownership validation
 * @returns {Promise<Object|null>}
 */
export async function getSampleById(id, shopId) {
  try {
    const doc = await collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }

    const data = prepareDoc({doc});

    // Security: Validate document belongs to this shop
    if (data.shopId !== shopId) {
      console.error(`Unauthorized access attempt: ${shopId} tried to access ${id}`);
      return null;
    }

    return data;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * Get paginated list with filtering and sorting
 * Uses paginateQuery helper for cursor-based pagination
 *
 * @param {Object} params
 * @param {string} params.shopId - Shop ID (required)
 * @param {Object} params.query - Query parameters
 * @param {string} params.query.order - Sort order (e.g., "createdAt_desc")
 * @param {string} params.query.status - Filter by status
 * @param {string} params.query.type - Filter by type
 * @param {string} params.query.after - Cursor for next page
 * @param {string} params.query.before - Cursor for previous page
 * @param {number} params.query.limit - Items per page (default: 20)
 * @param {boolean} params.query.hasCount - Include total count
 * @param {string[]} params.pickedFields - Fields to select (empty = all)
 * @returns {Promise<{data: Array, count: number, total?: number, pageInfo: {hasNext: boolean, hasPre: boolean, totalPage?: number}}>}
 */
export async function getSampleList({shopId, query = {}, pickedFields = []}) {
  try {
    const {order, status, type} = query;

    // Always start with shopId filter (multi-tenant requirement)
    let queriedRef = collection.where('shopId', '==', shopId);

    // Apply optional filters
    if (status) {
      queriedRef = queriedRef.where('status', '==', status);
    }
    if (type) {
      queriedRef = queriedRef.where('type', '==', type);
    }

    // Apply sorting (default: updatedAt desc)
    const {sortField, direction} = getOrderBy(order);
    queriedRef = queriedRef.orderBy(sortField, direction);

    // Use paginateQuery for cursor-based pagination
    return await paginateQuery({
      queriedRef,
      collection,
      query,
      pickedFields
    });
  } catch (e) {
    console.error(e);
    return {
      data: [],
      count: 0,
      pageInfo: {hasNext: false, hasPre: false},
      error: e.message
    };
  }
}

/**
 * Get multiple documents by IDs
 * Uses batched queries to handle Firestore's 'in' operator limit (30)
 *
 * @param {string} shopId - Shop ID
 * @param {string[]} ids - Array of document IDs
 * @returns {Promise<Array>}
 */
export async function getSamplesByIds(shopId, ids) {
  if (!ids?.length) return [];

  return await getByIds({
    collection,
    ids,
    filters: {shopId}
  });
}

/**
 * Get all documents for a shop (use with caution for large datasets)
 * Consider using getSampleList with pagination for large collections
 *
 * @param {string} shopId - Shop ID
 * @returns {Promise<Array>}
 */
export async function getAllSamples(shopId) {
  try {
    const docs = await collection.where('shopId', '==', shopId).get();

    return docs.docs.map(doc => prepareDoc({doc}));
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Check if a record exists and belongs to shop
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @returns {Promise<boolean>}
 */
export async function sampleExists(id, shopId) {
  const sample = await getSampleById(id, shopId);
  return sample !== null;
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new document
 * Auto-generates ID and adds timestamps
 *
 * @param {string} shopId - Shop ID
 * @param {Object} data - Document data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createSample(shopId, data) {
  try {
    const now = new Date();
    const docData = {
      ...data,
      shopId,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await collection.add(docData);

    return {
      success: true,
      data: {id: docRef.id, ...docData}
    };
  } catch (e) {
    console.error(e);
    return {success: false, error: e.message};
  }
}

/**
 * Create a document with a specific ID
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @param {Object} data - Document data
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createSampleWithId(id, shopId, data) {
  try {
    const now = new Date();
    const docData = {
      ...data,
      shopId,
      createdAt: now,
      updatedAt: now
    };

    await collection.doc(id).set(docData);

    return {
      success: true,
      data: {id, ...docData}
    };
  } catch (e) {
    console.error(e);
    return {success: false, error: e.message};
  }
}

/**
 * Update a document by ID
 * Validates ownership before updating
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @param {Object} data - Fields to update
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateSampleById(id, shopId, data) {
  try {
    // Validate ownership
    const existing = await getSampleById(id, shopId);
    if (!existing) {
      return {success: false, error: 'Document not found or access denied'};
    }

    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.shopId;
    delete updateData.createdAt;

    await collection.doc(id).update(updateData);

    return {
      success: true,
      data: {id, ...existing, ...updateData}
    };
  } catch (e) {
    console.error(e);
    return {success: false, error: e.message};
  }
}

/**
 * Update using FieldValue operations (increment, arrayUnion, etc.)
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @param {Object} updates - Field updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSampleWithFieldValue(id, shopId, updates) {
  try {
    const existing = await getSampleById(id, shopId);
    if (!existing) {
      return {success: false, error: 'Document not found or access denied'};
    }

    await collection.doc(id).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    });

    return {success: true};
  } catch (e) {
    console.error(e);
    return {success: false, error: e.message};
  }
}

/**
 * Increment a numeric field
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @param {string} field - Field name to increment
 * @param {number} amount - Amount to increment (can be negative)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function incrementSampleField(id, shopId, field, amount) {
  return await updateSampleWithFieldValue(id, shopId, {
    [field]: FieldValue.increment(amount)
  });
}

/**
 * Delete a document by ID
 * Validates ownership before deleting
 *
 * @param {string} id - Document ID
 * @param {string} shopId - Shop ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteSampleById(id, shopId) {
  try {
    const existing = await getSampleById(id, shopId);
    if (!existing) {
      return {success: false, error: 'Document not found or access denied'};
    }

    await collection.doc(id).delete();

    return {success: true};
  } catch (e) {
    console.error(e);
    return {success: false, error: e.message};
  }
}

// ============================================================================
// BATCH OPERATIONS (for 500+ documents)
// ============================================================================

/**
 * Create multiple documents in batches
 * Firestore limit: 500 operations per batch
 *
 * @param {string} shopId - Shop ID
 * @param {Array<Object>} items - Items to create
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function batchCreateSamples(shopId, items) {
  try {
    const now = new Date();
    const data = items.map(item => ({
      ...item,
      shopId,
      createdAt: now,
      updatedAt: now
    }));

    await batchCreate({firestore, collection, data});

    return {success: true, count: items.length};
  } catch (e) {
    console.error(e);
    return {success: false, count: 0, error: e.message};
  }
}

/**
 * Update multiple documents by query
 *
 * @param {string} shopId - Shop ID
 * @param {Object} filter - Query filter
 * @param {Object} updateData - Data to update
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function batchUpdateSamplesByQuery(shopId, filter, updateData) {
  try {
    let queriedRef = collection.where('shopId', '==', shopId);

    // Apply filters
    Object.entries(filter).forEach(([field, value]) => {
      queriedRef = queriedRef.where(field, '==', value);
    });

    const snapshot = await queriedRef.get();
    if (snapshot.empty) {
      return {success: true, count: 0};
    }

    await batchUpdate(firestore, snapshot.docs, {
      ...updateData,
      updatedAt: new Date()
    });

    return {success: true, count: snapshot.size};
  } catch (e) {
    console.error(e);
    return {success: false, count: 0, error: e.message};
  }
}

/**
 * Delete multiple documents by query
 *
 * @param {string} shopId - Shop ID
 * @param {Object} filter - Query filter
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function batchDeleteSamplesByQuery(shopId, filter) {
  try {
    let queriedRef = collection.where('shopId', '==', shopId);

    Object.entries(filter).forEach(([field, value]) => {
      queriedRef = queriedRef.where(field, '==', value);
    });

    const snapshot = await queriedRef.get();
    if (snapshot.empty) {
      return {success: true, count: 0};
    }

    await batchDelete(firestore, snapshot.docs);

    return {success: true, count: snapshot.size};
  } catch (e) {
    console.error(e);
    return {success: false, count: 0, error: e.message};
  }
}

/**
 * Delete all documents for a shop (use for uninstall cleanup)
 *
 * @param {string} shopId - Shop ID
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function deleteAllSamplesForShop(shopId) {
  return await batchDeleteSamplesByQuery(shopId, {});
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Count documents matching a query
 *
 * @param {string} shopId - Shop ID
 * @param {Object} filter - Query filter
 * @returns {Promise<number>}
 */
export async function countSamples(shopId, filter = {}) {
  try {
    let queriedRef = collection.where('shopId', '==', shopId);

    Object.entries(filter).forEach(([field, value]) => {
      queriedRef = queriedRef.where(field, '==', value);
    });

    const countResult = await queriedRef.count().get();
    return countResult.data().count;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

/**
 * Check if a field value is unique within a shop
 *
 * @param {string} shopId - Shop ID
 * @param {string} field - Field name
 * @param {*} value - Field value
 * @param {string} excludeId - ID to exclude (for updates)
 * @returns {Promise<boolean>}
 */
export async function isSampleFieldUnique(shopId, field, value, excludeId = null) {
  try {
    const docs = await collection
      .where('shopId', '==', shopId)
      .where(field, '==', value)
      .limit(1)
      .get();

    if (docs.empty) return true;

    // If excludeId provided, check if the found doc is the excluded one
    if (excludeId && docs.docs[0].id === excludeId) {
      return true;
    }

    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
}