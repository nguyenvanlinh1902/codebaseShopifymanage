import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('tags');

/**
 * Create a new tag
 *
 * @param {Object} data - Tag data
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.name - Tag name
 * @param {string} [data.color='gray'] - Tag color
 * @returns {Promise<Tag>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();
  const normalizedName = data.name.toLowerCase().trim();

  // Check if tag with same name exists
  const existing = await getByName(data.organizationId, normalizedName);
  if (existing) {
    throw new Error(`Tag "${data.name}" already exists`);
  }

  const tagData = {
    organizationId: data.organizationId,
    name: normalizedName,
    color: data.color || 'gray',
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(tagData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get tag by ID
 *
 * @param {string} id - Tag ID
 * @returns {Promise<Tag|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get tag by name within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} name - Tag name (case-insensitive)
 * @returns {Promise<Tag|null>}
 */
export async function getByName(organizationId, name) {
  const normalizedName = name.toLowerCase().trim();
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('name', '==', normalizedName)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get or create a tag by name
 *
 * @param {string} organizationId - Organization ID
 * @param {string} name - Tag name
 * @param {string} [color='gray'] - Tag color if creating
 * @returns {Promise<Tag>}
 */
export async function getOrCreate(organizationId, name, color = 'gray') {
  const existing = await getByName(organizationId, name);
  if (existing) {
    return existing;
  }
  return create({organizationId, name, color});
}

/**
 * List all tags for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Tag[]>}
 */
export async function listByOrganization(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .orderBy('name', 'asc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Get tags by IDs
 *
 * @param {string[]} ids - Array of tag IDs
 * @returns {Promise<Tag[]>}
 */
export async function getByIds(ids) {
  if (!ids || ids.length === 0) {
    return [];
  }

  // Firestore 'in' limit is 30
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }

  const allTags = [];
  for (const chunk of chunks) {
    const snapshot = await collection
      .where('__name__', 'in', chunk.map(id => collection.doc(id)))
      .get();
    allTags.push(...snapshot.docs.map(doc => prepareDoc({doc})));
  }

  return allTags;
}

/**
 * Update tag
 *
 * @param {string} id - Tag ID
 * @param {Partial<Tag>} data - Fields to update
 * @returns {Promise<Tag>}
 */
export async function update(id, data) {
  const updateData = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (data.name !== undefined) {
    updateData.name = data.name.toLowerCase().trim();
  }
  if (data.color !== undefined) {
    updateData.color = data.color;
  }

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Delete tag
 *
 * @param {string} id - Tag ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

/**
 * Merge two tags (move all references from source to target)
 * Note: This only deletes the source tag. Caller must update ticket tagIds separately.
 *
 * @param {string} sourceId - Tag ID to merge from (will be deleted)
 * @param {string} targetId - Tag ID to merge into
 * @returns {Promise<Tag>} The target tag
 */
export async function merge(sourceId, targetId) {
  // Delete source tag
  await remove(sourceId);
  // Return target tag
  return getById(targetId);
}

/**
 * Count tags by organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>}
 */
export async function countByOrganization(organizationId) {
  const snapshot = await collection.where('organizationId', '==', organizationId).count().get();
  return snapshot.data().count;
}

export {collection, firestore};
