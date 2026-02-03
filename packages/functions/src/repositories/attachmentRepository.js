import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('attachments');

/**
 * Create a new attachment
 *
 * @param {Object} data - Attachment data
 * @param {string} data.messageId - Message ID
 * @param {string} data.filename - Original filename
 * @param {string} data.contentType - MIME type
 * @param {number} data.sizeBytes - File size in bytes
 * @param {string} data.storageUrl - Cloud Storage URL
 * @returns {Promise<Attachment>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();

  const attachmentData = {
    messageId: data.messageId,
    filename: data.filename,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    storageUrl: data.storageUrl,
    createdAt: now
  };

  const docRef = await collection.add(attachmentData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Create multiple attachments
 *
 * @param {Array<Object>} attachments - Array of attachment data
 * @returns {Promise<Attachment[]>}
 */
export async function createMany(attachments) {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const now = FieldValue.serverTimestamp();
  const batch = firestore.batch();
  const docRefs = [];

  attachments.forEach(data => {
    const docRef = collection.doc();
    docRefs.push(docRef);
    batch.set(docRef, {
      messageId: data.messageId,
      filename: data.filename,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      storageUrl: data.storageUrl,
      createdAt: now
    });
  });

  await batch.commit();

  // Fetch created documents
  const docs = await Promise.all(docRefs.map(ref => ref.get()));
  return docs.map(doc => prepareDoc({doc}));
}

/**
 * Get attachment by ID
 *
 * @param {string} id - Attachment ID
 * @returns {Promise<Attachment|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * List attachments by message
 *
 * @param {string} messageId - Message ID
 * @returns {Promise<Attachment[]>}
 */
export async function listByMessage(messageId) {
  const snapshot = await collection
    .where('messageId', '==', messageId)
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Get attachments for multiple messages
 *
 * @param {string[]} messageIds - Array of message IDs
 * @returns {Promise<Map<string, Attachment[]>>} Map of messageId to attachments
 */
export async function getByMessageIds(messageIds) {
  if (!messageIds || messageIds.length === 0) {
    return new Map();
  }

  // Firestore 'in' limit is 30, so chunk if needed
  const chunks = [];
  for (let i = 0; i < messageIds.length; i += 30) {
    chunks.push(messageIds.slice(i, i + 30));
  }

  const allAttachments = [];
  for (const chunk of chunks) {
    const snapshot = await collection.where('messageId', 'in', chunk).get();
    allAttachments.push(...snapshot.docs.map(doc => prepareDoc({doc})));
  }

  // Group by message ID
  const grouped = new Map();
  allAttachments.forEach(attachment => {
    if (!grouped.has(attachment.messageId)) {
      grouped.set(attachment.messageId, []);
    }
    grouped.get(attachment.messageId).push(attachment);
  });

  return grouped;
}

/**
 * Delete attachment
 *
 * @param {string} id - Attachment ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

/**
 * Delete all attachments for a message
 *
 * @param {string} messageId - Message ID
 * @returns {Promise<number>} Number of deleted attachments
 */
export async function deleteByMessage(messageId) {
  const snapshot = await collection.where('messageId', '==', messageId).get();

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
 * Get total storage used by organization (for quota tracking)
 *
 * @param {string[]} messageIds - Array of message IDs belonging to organization
 * @returns {Promise<number>} Total bytes
 */
export async function getTotalSizeForMessages(messageIds) {
  if (!messageIds || messageIds.length === 0) {
    return 0;
  }

  // Firestore 'in' limit is 30, so chunk if needed
  const chunks = [];
  for (let i = 0; i < messageIds.length; i += 30) {
    chunks.push(messageIds.slice(i, i + 30));
  }

  let totalSize = 0;
  for (const chunk of chunks) {
    const snapshot = await collection.where('messageId', 'in', chunk).select('sizeBytes').get();
    snapshot.docs.forEach(doc => {
      totalSize += doc.data().sizeBytes || 0;
    });
  }

  return totalSize;
}

export {collection, firestore};
