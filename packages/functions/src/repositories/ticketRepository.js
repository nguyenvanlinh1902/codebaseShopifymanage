import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('tickets');

/**
 * Create a new ticket
 *
 * @param {Object} data - Ticket data
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.subject - Ticket subject
 * @param {string} data.customerEmail - Customer email
 * @param {string} data.customerName - Customer name
 * @param {string} [data.customerId] - Customer ID if matched
 * @param {'email'|'manual'} [data.channel='email'] - Ticket channel
 * @returns {Promise<Ticket>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();

  // Get next ticket number for organization
  const number = await getNextTicketNumber(data.organizationId);

  const ticketData = {
    organizationId: data.organizationId,
    customerId: data.customerId || null,
    assigneeId: data.assigneeId || null,
    number,
    subject: data.subject,
    status: 'open',
    priority: 'normal',
    channel: data.channel || 'email',
    customerEmail: data.customerEmail.toLowerCase().trim(),
    customerName: data.customerName,
    tagIds: [],
    relatedTicketId: data.relatedTicketId || null,
    messageCount: 0,
    lastMessageAt: now,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(ticketData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get next ticket number for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>}
 * @private
 */
async function getNextTicketNumber(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .orderBy('number', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return 1001; // Start from 1001 for better readability
  }
  return snapshot.docs[0].data().number + 1;
}

/**
 * Get ticket by ID
 *
 * @param {string} id - Ticket ID
 * @returns {Promise<Ticket|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get ticket by number within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {number} number - Ticket number
 * @returns {Promise<Ticket|null>}
 */
export async function getByNumber(organizationId, number) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('number', '==', number)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * List tickets by organization with filters and pagination
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {TicketFilters} [params.filters={}] - Filter options
 * @param {PaginationQuery} [params.query={}] - Pagination options
 * @returns {Promise<PaginationResult<Ticket>>}
 */
export async function listByOrganization({organizationId, filters = {}, query = {}}) {
  let queriedRef = collection.where('organizationId', '==', organizationId);

  // Apply filters
  if (filters.status) {
    queriedRef = queriedRef.where('status', '==', filters.status);
  }
  if (filters.priority) {
    queriedRef = queriedRef.where('priority', '==', filters.priority);
  }
  if (filters.assigneeId) {
    queriedRef = queriedRef.where('assigneeId', '==', filters.assigneeId);
  }
  if (filters.customerId) {
    queriedRef = queriedRef.where('customerId', '==', filters.customerId);
  }
  if (filters.tagId) {
    queriedRef = queriedRef.where('tagIds', 'array-contains', filters.tagId);
  }

  const {sortField, direction} = getOrderBy(query.order || 'lastMessageAt_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * List tickets by customer
 *
 * @param {string} customerId - Customer ID
 * @param {PaginationQuery} [query={}] - Pagination options
 * @returns {Promise<PaginationResult<Ticket>>}
 */
export async function listByCustomer(customerId, query = {}) {
  let queriedRef = collection.where('customerId', '==', customerId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAt_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * List tickets by assignee
 *
 * @param {string} assigneeId - Assignee user ID
 * @param {PaginationQuery} [query={}] - Pagination options
 * @returns {Promise<PaginationResult<Ticket>>}
 */
export async function listByAssignee(assigneeId, query = {}) {
  let queriedRef = collection.where('assigneeId', '==', assigneeId);
  const {sortField, direction} = getOrderBy(query.order || 'lastMessageAt_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Get open tickets count for a customer (for sidebar)
 *
 * @param {string} customerId - Customer ID
 * @param {string} excludeTicketId - Current ticket ID to exclude
 * @returns {Promise<number>}
 */
export async function getOpenTicketCountForCustomer(customerId, excludeTicketId) {
  const snapshot = await collection
    .where('customerId', '==', customerId)
    .where('status', 'in', ['open', 'pending'])
    .get();

  // Filter out the current ticket
  return snapshot.docs.filter(doc => doc.id !== excludeTicketId).length;
}

/**
 * Search tickets by email or subject
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Ticket[]>}
 */
export async function search(organizationId, searchTerm, limit = 20) {
  // Note: Firestore doesn't support full-text search
  // This is a basic implementation searching by customer email
  // For production, consider using Algolia or Elasticsearch
  const normalizedTerm = searchTerm.toLowerCase().trim();

  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('customerEmail', '>=', normalizedTerm)
    .where('customerEmail', '<=', normalizedTerm + '\uf8ff')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Update ticket
 *
 * @param {string} id - Ticket ID
 * @param {Partial<Ticket>} data - Fields to update
 * @returns {Promise<Ticket>}
 */
export async function update(id, data) {
  const updateData = {
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  };
  // Remove fields that shouldn't be updated directly
  delete updateData.id;
  delete updateData.createdAt;
  delete updateData.organizationId;
  delete updateData.number;

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Update ticket status
 *
 * @param {string} id - Ticket ID
 * @param {'open'|'pending'|'resolved'|'closed'} status - New status
 * @returns {Promise<Ticket>}
 */
export async function updateStatus(id, status) {
  const updateData = {
    status,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (status === 'resolved') {
    updateData.resolvedAt = FieldValue.serverTimestamp();
  } else if (status === 'closed') {
    updateData.closedAt = FieldValue.serverTimestamp();
  }

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Assign ticket to user
 *
 * @param {string} id - Ticket ID
 * @param {string|null} assigneeId - User ID to assign (null to unassign)
 * @returns {Promise<Ticket>}
 */
export async function assign(id, assigneeId) {
  await collection.doc(id).update({
    assigneeId,
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Update ticket priority
 *
 * @param {string} id - Ticket ID
 * @param {'low'|'normal'|'high'|'urgent'} priority - New priority
 * @returns {Promise<Ticket>}
 */
export async function updatePriority(id, priority) {
  await collection.doc(id).update({
    priority,
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Add tag to ticket
 *
 * @param {string} id - Ticket ID
 * @param {string} tagId - Tag ID to add
 * @returns {Promise<Ticket>}
 */
export async function addTag(id, tagId) {
  await collection.doc(id).update({
    tagIds: FieldValue.arrayUnion(tagId),
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Remove tag from ticket
 *
 * @param {string} id - Ticket ID
 * @param {string} tagId - Tag ID to remove
 * @returns {Promise<Ticket>}
 */
export async function removeTag(id, tagId) {
  await collection.doc(id).update({
    tagIds: FieldValue.arrayRemove(tagId),
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Increment message count and update last message time
 *
 * @param {string} id - Ticket ID
 * @returns {Promise<void>}
 */
export async function incrementMessageCount(id) {
  await collection.doc(id).update({
    messageCount: FieldValue.increment(1),
    lastMessageAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

/**
 * Get tickets that need auto-close (resolved for X days)
 *
 * @param {number} daysOld - Number of days since resolved
 * @param {number} [limit=100] - Max tickets to return
 * @returns {Promise<Ticket[]>}
 */
export async function getTicketsForAutoClose(daysOld, limit = 100) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const snapshot = await collection
    .where('status', '==', 'resolved')
    .where('resolvedAt', '<=', cutoffDate)
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Count tickets by status for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{open: number, pending: number, resolved: number, closed: number}>}
 */
export async function countByStatus(organizationId) {
  const statuses = ['open', 'pending', 'resolved', 'closed'];
  const counts = await Promise.all(
    statuses.map(async status => {
      const snapshot = await collection
        .where('organizationId', '==', organizationId)
        .where('status', '==', status)
        .count()
        .get();
      return {[status]: snapshot.data().count};
    })
  );
  return Object.assign({}, ...counts);
}

/**
 * Count open tickets per assignee (for workload display)
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array<{assigneeId: string, count: number}>>}
 */
export async function countByAssignee(organizationId) {
  // Get all open/pending tickets
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('status', 'in', ['open', 'pending'])
    .select('assigneeId')
    .get();

  // Count by assignee
  const counts = {};
  snapshot.docs.forEach(doc => {
    const assigneeId = doc.data().assigneeId;
    if (assigneeId) {
      counts[assigneeId] = (counts[assigneeId] || 0) + 1;
    }
  });

  return Object.entries(counts).map(([assigneeId, count]) => ({assigneeId, count}));
}

/**
 * Delete ticket (soft delete not implemented - use with caution)
 *
 * @param {string} id - Ticket ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

export {collection, firestore};
