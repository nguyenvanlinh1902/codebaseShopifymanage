import {chunk, flatten} from '@avada/utils';
import {formatDateFields} from '@avada/firestore-utils';
import {FieldPath} from '@google-cloud/firestore/build/src';

/**
 * @fileoverview Firestore repository helper functions.
 *
 * This module provides common utilities for Firestore operations:
 * - Document preparation and formatting
 * - Cursor-based pagination
 * - Batch operations (create, update, delete)
 * - Query helpers
 *
 * @example
 * // Using paginateQuery in a repository
 * import {paginateQuery, getOrderBy} from './helper';
 *
 * export async function getItems({shopId, query}) {
 *   let queriedRef = collection.where('shopId', '==', shopId);
 *   const {sortField, direction} = getOrderBy(query.order);
 *   queriedRef = queriedRef.orderBy(sortField, direction);
 *   return await paginateQuery({queriedRef, collection, query});
 * }
 */

/** @constant {number} Maximum documents per Firestore batch operation */
const BATCH_SIZE = 500;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} PaginationQuery
 * @property {string} [after] - Document ID to start after (next page cursor)
 * @property {string} [before] - Document ID to end before (previous page cursor)
 * @property {number|string} [limit=20] - Number of items per page
 * @property {boolean} [hasCount=false] - Whether to include total count
 * @property {boolean} [getAll=false] - Whether to fetch all documents (ignores pagination)
 * @property {boolean} [withDocs=false] - Whether to include raw Firestore docs in response
 */

/**
 * @typedef {Object} PaginationResult
 * @property {Array<Object>} data - Array of formatted documents
 * @property {number} count - Number of documents returned in this page
 * @property {number} [total] - Total count of documents (if hasCount=true)
 * @property {Object} pageInfo - Pagination metadata
 * @property {boolean} pageInfo.hasPre - Whether previous page exists
 * @property {boolean} pageInfo.hasNext - Whether next page exists
 * @property {number} [pageInfo.totalPage] - Total number of pages (if hasCount=true)
 * @property {FirebaseFirestore.QuerySnapshot} [docs] - Raw Firestore docs (if withDocs=true)
 */

/**
 * @typedef {Object} FilterOperator
 * @property {string} operator - Firestore operator ('==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains', etc.)
 * @property {*} value - Value to compare against
 */

// ============================================================================
// DOCUMENT HELPERS
// ============================================================================

/**
 * Prepares a Firestore document for API response.
 * Extracts data from DocumentSnapshot and formats date fields.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.DocumentSnapshot} [params.doc] - Firestore document snapshot
 * @param {Object} [params.data={}] - Pre-existing data (used if doc not provided)
 * @param {string} [params.keyId='id'] - Key name for document ID in output
 * @returns {Object} Formatted document with ID and converted date fields
 *
 * @example
 * const doc = await collection.doc('abc123').get();
 * const data = prepareDoc({doc});
 * // Returns: {id: 'abc123', name: '...', createdAt: Date, ...}
 */
export function prepareDoc({doc, data = {}, keyId = 'id'}) {
  if (doc) {
    data = typeof doc.data() === 'undefined' ? {} : {...doc.data(), [keyId]: doc.id};
  }
  return formatDateFields(data);
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Executes a paginated Firestore query with cursor-based navigation.
 *
 * Supports:
 * - Cursor-based pagination (after/before document IDs)
 * - Optional total count for UI pagination controls
 * - Field selection for optimized reads
 * - Automatic hasPre/hasNext detection
 *
 * @param {Object} params
 * @param {FirebaseFirestore.Query} params.queriedRef - Pre-filtered Firestore query (with where/orderBy applied)
 * @param {FirebaseFirestore.CollectionReference} params.collection - Collection reference for cursor lookups
 * @param {PaginationQuery} params.query - Pagination parameters
 * @param {number|string} [params.defaultLimit=query.limit] - Default page size
 * @param {string[]} [params.pickedFields=[]] - Fields to select (empty = all fields)
 * @returns {Promise<PaginationResult>} Paginated results with metadata
 *
 * @example
 * // Basic usage
 * const result = await paginateQuery({
 *   queriedRef: collection.where('shopId', '==', shopId).orderBy('createdAt', 'desc'),
 *   collection,
 *   query: {limit: 20, hasCount: true}
 * });
 *
 * @example
 * // With cursor (next page)
 * const nextPage = await paginateQuery({
 *   queriedRef,
 *   collection,
 *   query: {limit: 20, after: lastItemId}
 * });
 */
export async function paginateQuery({
  queriedRef,
  collection,
  query,
  defaultLimit = query.limit,
  pickedFields = []
}) {
  const limit = parseInt(defaultLimit || '20');
  let total;
  let totalPage;
  if (query.hasCount) {
    total = (await queriedRef.count().get()).data().count;
    totalPage = Math.ceil(total / limit);
  }

  const getAll = query.getAll || !limit;
  let hasPre = false;
  let hasNext = false;

  if (pickedFields.length) queriedRef = queriedRef.select(...pickedFields);
  if (!getAll) {
    if (query.after) {
      const after = await collection.doc(query.after).get();
      queriedRef = queriedRef.startAfter(after);

      hasPre = true;
    }
    if (query.before) {
      const before = await collection.doc(query.before).get();
      queriedRef = queriedRef.endBefore(before).limitToLast(limit);

      hasNext = true;
    } else {
      queriedRef = queriedRef.limit(limit);
    }
  }

  const docs = await queriedRef.get();

  const data = docs.docs.map(doc => prepareDoc({doc}));

  if (!getAll && (!hasPre || !hasNext)) {
    const [resultHasPre, resultHasNext] = await Promise.all([
      verifyHasPre(docs, queriedRef),
      verifyHasNext(docs, queriedRef)
    ]);
    if (!hasPre) {
      hasPre = resultHasPre;
    }
    if (!hasNext) {
      hasNext = resultHasNext;
    }
  }

  const resp = {data, count: docs.size, total, pageInfo: {hasPre, hasNext, totalPage}};
  return query.withDocs ? {...resp, docs} : resp;
}

/**
 * Checks if there are documents before the current page.
 *
 * @param {FirebaseFirestore.QuerySnapshot} objectDocs - Current page documents
 * @param {FirebaseFirestore.Query} queriedRef - Query reference
 * @returns {Promise<boolean>} True if previous page exists
 * @private
 */
export async function verifyHasPre(objectDocs, queriedRef) {
  if (objectDocs.size === 0) {
    return false;
  }

  const preRef = await queriedRef
    .endBefore(objectDocs.docs[0])
    .limit(1)
    .get();

  return preRef.size > 0;
}

/**
 * Checks if there are documents after the current page.
 *
 * @param {FirebaseFirestore.QuerySnapshot} objectDocs - Current page documents
 * @param {FirebaseFirestore.Query} queriedRef - Query reference
 * @returns {Promise<boolean>} True if next page exists
 * @private
 */
export async function verifyHasNext(objectDocs, queriedRef) {
  if (objectDocs.size === 0) {
    return false;
  }

  const nextRef = await queriedRef
    .startAfter(objectDocs.docs[objectDocs.size - 1])
    .limitToLast(1)
    .get();

  return nextRef.size > 0;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Parses sort parameter into field and direction.
 * Format: "fieldName_direction" (e.g., "createdAt_desc")
 *
 * @param {string} [sortType] - Sort parameter in format "field_direction"
 * @returns {{sortField: string, direction: 'asc'|'desc'}} Parsed sort configuration
 *
 * @example
 * getOrderBy('createdAt_desc')  // {sortField: 'createdAt', direction: 'desc'}
 * getOrderBy('name_asc')        // {sortField: 'name', direction: 'asc'}
 * getOrderBy()                  // {sortField: 'updatedAt', direction: 'desc'}
 */
export function getOrderBy(sortType) {
  const [sortField, direction] = sortType ? sortType.split('_') : ['updatedAt', 'desc'];
  return {sortField, direction};
}

/**
 * Builds a Firestore query from a filters object.
 * Supports both simple equality filters and complex operator filters.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.CollectionReference} params.collection - Collection to query
 * @param {Object.<string, *|FilterOperator>} [params.filters={}] - Filter conditions
 * @param {boolean} [params.cleanEmptyFilter=true] - Skip falsy filter values
 * @returns {FirebaseFirestore.Query} Firestore query with filters applied
 *
 * @example
 * // Simple equality filters
 * prepareQueryRef({collection, filters: {status: 'active', type: 'premium'}})
 *
 * @example
 * // Complex operator filters
 * prepareQueryRef({
 *   collection,
 *   filters: {
 *     status: 'active',
 *     points: {operator: '>=', value: 100}
 *   }
 * })
 * @private
 */
function prepareQueryRef({collection, filters = {}, cleanEmptyFilter = true}) {
  return Object.keys(filters).reduce((query, field) => {
    const val = filters[field];
    if (cleanEmptyFilter && !val) {
      return query;
    }
    if (isObject(val) && ['operator', 'value'].every(key => val.hasOwnProperty(key))) {
      const {operator, value} = val;
      return query.where(field, operator, value);
    }
    return query.where(field, '==', val);
  }, collection);
}

/**
 * Fetches documents by an array of IDs with automatic batching.
 * Handles Firestore's 'in' operator limit (10 items) by chunking requests.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.CollectionReference} params.collection - Collection to query
 * @param {string[]} params.ids - Array of document IDs to fetch
 * @param {string} [params.idField='id'] - Field to match IDs against ('id' uses document ID)
 * @param {Object.<string, *>} [params.filters={}] - Additional filter conditions
 * @param {string[]} [params.selectFields=[]] - Fields to select (empty = all)
 * @param {boolean} [params.selectDoc=false] - Return raw DocumentSnapshots instead of formatted data
 * @returns {Promise<Array<Object|FirebaseFirestore.DocumentSnapshot>>} Array of documents
 *
 * @example
 * // Fetch by document IDs
 * const items = await getByIds({
 *   collection,
 *   ids: ['id1', 'id2', 'id3'],
 *   filters: {shopId: 'shop123'}
 * });
 *
 * @example
 * // Fetch by custom field
 * const items = await getByIds({
 *   collection,
 *   ids: ['SKU001', 'SKU002'],
 *   idField: 'sku',
 *   selectFields: ['name', 'price']
 * });
 */
export async function getByIds({
  collection,
  ids,
  idField = 'id',
  filters = {},
  selectFields = [],
  selectDoc = false
}) {
  try {
    const idWhere = idField === 'id' ? FieldPath.documentId() : idField;
    const queriedRef = idBatch => {
      const query = prepareQueryRef({collection, filters}).where(idWhere, 'in', idBatch);
      return selectFields.length ? query.select(...selectFields) : query;
    };

    const batches = chunk(ids, 10);
    const rawDocs = await Promise.all(batches.map(batch => queriedRef(batch).get()));
    const allDocs = flatten(rawDocs.map(docs => docs.docs));

    return selectDoc ? allDocs : allDocs.map(doc => prepareDoc({doc}));
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Checks if a value is a plain object (not array or null).
 *
 * @param {*} obj - Value to check
 * @returns {boolean} True if plain object
 * @private
 */
function isObject(obj) {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Creates multiple documents in batches.
 * Automatically chunks data to respect Firestore's 500 operations per batch limit.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.Firestore} params.firestore - Firestore instance
 * @param {FirebaseFirestore.CollectionReference} params.collection - Target collection
 * @param {Array<Object>} params.data - Documents to create (IDs auto-generated)
 * @param {Function} [params.callbackFunc] - Called after each batch commits
 * @returns {Promise<void>}
 *
 * @example
 * await batchCreate({
 *   firestore,
 *   collection,
 *   data: items.map(item => ({...item, shopId, createdAt: new Date()}))
 * });
 */
export async function batchCreate({firestore, collection, data, callbackFunc = async () => {}}) {
  const batches = [];
  const dataChunks = chunk(data, BATCH_SIZE);
  dataChunks.forEach(dataChunk => {
    const batch = firestore.batch();
    dataChunk.forEach(dataItem => {
      batch.create(collection.doc(), dataItem);
    });
    batches.push({batch, size: dataChunk.length});
  });
  for (const {batch} of batches) {
    await batch.commit();
    await callbackFunc();
  }
}

/**
 * Updates multiple documents with the same data.
 * Use when applying identical updates to many documents.
 *
 * @param {FirebaseFirestore.Firestore} firestore - Firestore instance
 * @param {FirebaseFirestore.QueryDocumentSnapshot[]} docs - Documents to update
 * @param {Object} updateData - Data to apply to all documents
 * @returns {Promise<void>}
 *
 * @example
 * const snapshot = await collection.where('status', '==', 'pending').get();
 * await batchUpdate(firestore, snapshot.docs, {status: 'processed', updatedAt: new Date()});
 */
export async function batchUpdate(firestore, docs, updateData) {
  const batches = [];
  const docChunks = chunk(docs, BATCH_SIZE);
  docChunks.forEach(docChunk => {
    const batch = firestore.batch();
    docChunk.forEach(doc => {
      batch.update(doc.ref, updateData);
    });
    batches.push(batch);
  });
  for (const batch of batches) {
    await batch.commit();
  }
}

/**
 * Updates multiple documents with individual data.
 * Each item in data array must have an 'id' field.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.Firestore} params.firestore - Firestore instance
 * @param {FirebaseFirestore.CollectionReference} params.collection - Target collection
 * @param {Array<Object>} params.data - Documents to update (must include 'id' field)
 * @param {Function} [params.callbackFunc] - Called after each batch commits
 * @returns {Promise<void>}
 *
 * @example
 * await batchUpdateSeparateData({
 *   firestore,
 *   collection,
 *   data: [
 *     {id: 'doc1', points: 100},
 *     {id: 'doc2', points: 200}
 *   ]
 * });
 */
export async function batchUpdateSeparateData({
  firestore,
  collection,
  data,
  callbackFunc = async () => {}
}) {
  const batches = [];
  const docChunks = chunk(data, BATCH_SIZE);
  docChunks.forEach(docChunk => {
    const batch = firestore.batch();
    docChunk.forEach(dataItem => {
      const {id, ...updateData} = dataItem;
      if (!id) return;
      batch.update(collection.doc(id), updateData);
    });
    batches.push({batch, size: docChunk.length});
  });
  for (const {batch} of batches) {
    await batch.commit();
    await callbackFunc();
  }
}

/**
 * Deletes multiple documents in batches.
 *
 * @param {FirebaseFirestore.Firestore} firestore - Firestore instance
 * @param {FirebaseFirestore.QueryDocumentSnapshot[]} docs - Documents to delete
 * @returns {Promise<void>}
 *
 * @example
 * const snapshot = await collection.where('expired', '==', true).get();
 * await batchDelete(firestore, snapshot.docs);
 */
export async function batchDelete(firestore, docs) {
  const batches = [];
  const docChunks = chunk(docs, BATCH_SIZE);
  docChunks.forEach(docChunk => {
    const batch = firestore.batch();
    docChunk.forEach(doc => {
      batch.delete(doc.ref);
    });
    batches.push(batch);
  });
  for (const batch of batches) {
    await batch.commit();
  }
}

// ============================================================================
// RECURSIVE FETCH
// ============================================================================

/**
 * Recursively fetches all documents for a shop in chunks.
 * Use for large collections where you need all data (e.g., exports, migrations).
 *
 * WARNING: Can be memory-intensive for very large collections.
 * Consider using streaming or pagination for production use cases.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.CollectionReference} params.collection - Collection to query
 * @param {string} params.shopId - Shop ID filter
 * @param {number} [params.perPage=1000] - Documents per chunk
 * @param {FirebaseFirestore.DocumentSnapshot} [params.lastDoc=null] - Cursor for recursion
 * @param {Array<Object>} [params.data=[]] - Accumulated results (internal)
 * @returns {Promise<Array<Object>>} All documents for the shop
 *
 * @example
 * const allCustomers = await getDocsInChunks({
 *   collection: customersCollection,
 *   shopId: 'shop123'
 * });
 */
export async function getDocsInChunks({
  collection,
  shopId,
  perPage = 1000,
  lastDoc = null,
  data = []
}) {
  let query = collection.where('shopId', '==', shopId).limit(perPage);
  if (lastDoc) query = query.startAfter(lastDoc);

  const snapshot = await query.get();
  const docs = snapshot.docs;
  data.push(...docs.map(doc => ({...formatDateFields(doc.data()), id: doc.id})));

  if (docs.length < perPage) return data;

  lastDoc = docs[docs.length - 1];
  return await getDocsInChunks({collection, shopId, lastDoc, data});
}
