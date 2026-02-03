import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('activities');

/**
 * Create an activity log entry
 *
 * @param {Object} data - Activity data
 * @param {string} data.ticketId - Ticket ID
 * @param {string} [data.userId] - User who performed the action (null for system actions)
 * @param {Activity['action']} data.action - Action type
 * @param {string} [data.oldValue] - Previous value
 * @param {string} [data.newValue] - New value
 * @param {Object} [data.metadata] - Additional metadata
 * @returns {Promise<Activity>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();

  const activityData = {
    ticketId: data.ticketId,
    userId: data.userId || null,
    action: data.action,
    oldValue: data.oldValue || null,
    newValue: data.newValue || null,
    metadata: data.metadata || null,
    createdAt: now
  };

  const docRef = await collection.add(activityData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Log ticket created
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} [userId] - User who created the ticket
 * @param {Object} [metadata] - Additional metadata
 * @returns {Promise<Activity>}
 */
export async function logCreated(ticketId, userId, metadata) {
  return create({
    ticketId,
    userId,
    action: 'created',
    metadata
  });
}

/**
 * Log status change
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who changed status
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {Promise<Activity>}
 */
export async function logStatusChanged(ticketId, userId, oldStatus, newStatus) {
  return create({
    ticketId,
    userId,
    action: 'status_changed',
    oldValue: oldStatus,
    newValue: newStatus
  });
}

/**
 * Log assignment change
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who changed assignment
 * @param {string} [oldAssigneeId] - Previous assignee ID
 * @param {string} [newAssigneeId] - New assignee ID
 * @param {Object} [metadata] - Names for display
 * @returns {Promise<Activity>}
 */
export async function logAssigned(ticketId, userId, oldAssigneeId, newAssigneeId, metadata) {
  return create({
    ticketId,
    userId,
    action: 'assigned',
    oldValue: oldAssigneeId,
    newValue: newAssigneeId,
    metadata
  });
}

/**
 * Log priority change
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who changed priority
 * @param {string} oldPriority - Previous priority
 * @param {string} newPriority - New priority
 * @returns {Promise<Activity>}
 */
export async function logPriorityChanged(ticketId, userId, oldPriority, newPriority) {
  return create({
    ticketId,
    userId,
    action: 'priority_changed',
    oldValue: oldPriority,
    newValue: newPriority
  });
}

/**
 * Log tag added
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who added tag
 * @param {string} tagId - Tag ID
 * @param {string} tagName - Tag name for display
 * @returns {Promise<Activity>}
 */
export async function logTagged(ticketId, userId, tagId, tagName) {
  return create({
    ticketId,
    userId,
    action: 'tagged',
    newValue: tagId,
    metadata: {tagName}
  });
}

/**
 * Log tag removed
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who removed tag
 * @param {string} tagId - Tag ID
 * @param {string} tagName - Tag name for display
 * @returns {Promise<Activity>}
 */
export async function logUntagged(ticketId, userId, tagId, tagName) {
  return create({
    ticketId,
    userId,
    action: 'untagged',
    oldValue: tagId,
    metadata: {tagName}
  });
}

/**
 * Log reply sent
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who replied
 * @param {string} [messageId] - Message ID
 * @returns {Promise<Activity>}
 */
export async function logReplied(ticketId, userId, messageId) {
  return create({
    ticketId,
    userId,
    action: 'replied',
    metadata: {messageId}
  });
}

/**
 * Log internal note added
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User who added note
 * @param {string} [messageId] - Message ID
 * @returns {Promise<Activity>}
 */
export async function logNoteAdded(ticketId, userId, messageId) {
  return create({
    ticketId,
    userId,
    action: 'note_added',
    metadata: {messageId}
  });
}

/**
 * Get activity by ID
 *
 * @param {string} id - Activity ID
 * @returns {Promise<Activity|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * List activities by ticket with pagination
 *
 * @param {string} ticketId - Ticket ID
 * @param {PaginationQuery} [query={}] - Pagination options
 * @returns {Promise<PaginationResult<Activity>>}
 */
export async function listByTicket(ticketId, query = {}) {
  let queriedRef = collection.where('ticketId', '==', ticketId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAt_asc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Get all activities for a ticket (no pagination)
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Activity[]>}
 */
export async function getAllByTicket(ticketId) {
  const snapshot = await collection
    .where('ticketId', '==', ticketId)
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Delete all activities for a ticket
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<number>} Number of deleted activities
 */
export async function deleteByTicket(ticketId) {
  const snapshot = await collection.where('ticketId', '==', ticketId).get();

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

export {collection, firestore};
