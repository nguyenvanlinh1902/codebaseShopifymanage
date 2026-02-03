import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('messages');

/**
 * Create a new message
 *
 * @param {Object} data - Message data
 * @param {string} data.ticketId - Ticket ID
 * @param {string} [data.userId] - User ID (null for customer messages)
 * @param {'reply'|'note'|'system'} data.type - Message type
 * @param {string} data.contentText - Plain text content
 * @param {string} [data.contentHtml] - HTML content
 * @param {'customer'|'agent'} data.senderType - Sender type
 * @param {string} data.senderEmail - Sender email
 * @param {string} data.senderName - Sender name
 * @param {string} [data.emailMessageId] - Email message ID for threading
 * @param {boolean} [data.isInternal=false] - Whether message is internal note
 * @returns {Promise<Message>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();

  const messageData = {
    ticketId: data.ticketId,
    userId: data.userId || null,
    type: data.type,
    contentText: data.contentText,
    contentHtml: data.contentHtml || null,
    senderType: data.senderType,
    senderEmail: data.senderEmail,
    senderName: data.senderName,
    emailMessageId: data.emailMessageId || null,
    isInternal: data.isInternal || false,
    createdAt: now
  };

  const docRef = await collection.add(messageData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get message by ID
 *
 * @param {string} id - Message ID
 * @returns {Promise<Message|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * List messages by ticket with pagination
 *
 * @param {string} ticketId - Ticket ID
 * @param {PaginationQuery} [query={}] - Pagination options
 * @returns {Promise<PaginationResult<Message>>}
 */
export async function listByTicket(ticketId, query = {}) {
  let queriedRef = collection.where('ticketId', '==', ticketId);
  const {sortField, direction} = getOrderBy(query.order || 'createdAt_asc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * Get all messages for a ticket (no pagination - for full conversation)
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Message[]>}
 */
export async function getAllByTicket(ticketId) {
  const snapshot = await collection
    .where('ticketId', '==', ticketId)
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Get the latest message for a ticket
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Message|null>}
 */
export async function getLatestByTicket(ticketId) {
  const snapshot = await collection
    .where('ticketId', '==', ticketId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get latest customer message for a ticket
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Message|null>}
 */
export async function getLatestCustomerMessage(ticketId) {
  const snapshot = await collection
    .where('ticketId', '==', ticketId)
    .where('senderType', '==', 'customer')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get message by email message ID (for threading)
 *
 * @param {string} emailMessageId - Email message ID
 * @returns {Promise<Message|null>}
 */
export async function getByEmailMessageId(emailMessageId) {
  const snapshot = await collection
    .where('emailMessageId', '==', emailMessageId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Find existing message thread by email references
 *
 * @param {string[]} references - Array of email message IDs from References header
 * @returns {Promise<Message|null>}
 */
export async function findByEmailReferences(references) {
  if (!references || references.length === 0) {
    return null;
  }

  // Check up to 10 references (Firestore 'in' limit)
  const checkRefs = references.slice(0, 10);
  const snapshot = await collection
    .where('emailMessageId', 'in', checkRefs)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Count messages by ticket
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<number>}
 */
export async function countByTicket(ticketId) {
  const snapshot = await collection.where('ticketId', '==', ticketId).count().get();
  return snapshot.data().count;
}

/**
 * Get non-internal messages for quoting in email replies
 *
 * @param {string} ticketId - Ticket ID
 * @param {number} [limit=5] - Max messages to include
 * @returns {Promise<Message[]>}
 */
export async function getRecentPublicMessages(ticketId, limit = 5) {
  const snapshot = await collection
    .where('ticketId', '==', ticketId)
    .where('isInternal', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  // Reverse to get chronological order
  return snapshot.docs.map(doc => prepareDoc({doc})).reverse();
}

/**
 * Delete all messages for a ticket (for ticket deletion)
 *
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<number>} Number of deleted messages
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
