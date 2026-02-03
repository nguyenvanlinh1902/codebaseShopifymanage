import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc, paginateQuery, getOrderBy} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('users');

/**
 * Create a new user
 *
 * @param {Object} data - User data
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.email - User email
 * @param {string} data.passwordHash - Hashed password
 * @param {string} data.name - User name
 * @param {'owner'|'admin'|'agent'} data.role - User role
 * @param {'active'|'invited'} [data.status='active'] - User status
 * @returns {Promise<User>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();
  const userData = {
    organizationId: data.organizationId,
    email: data.email.toLowerCase().trim(),
    passwordHash: data.passwordHash,
    name: data.name,
    avatarUrl: data.avatarUrl || null,
    role: data.role,
    status: data.status || 'active',
    lastLoginAt: null,
    notificationPreferences: {
      emailOnAssignment: true,
      emailOnCustomerReply: true
    },
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(userData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get user by ID
 *
 * @param {string} id - User ID
 * @returns {Promise<User|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get user by email within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} email - User email
 * @returns {Promise<User|null>}
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
 * Get user by email (global - for login)
 *
 * @param {string} email - User email
 * @returns {Promise<User|null>}
 */
export async function getByEmailGlobal(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const snapshot = await collection.where('email', '==', normalizedEmail).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * List users by organization with pagination
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {PaginationQuery} [params.query={}] - Pagination options
 * @param {string} [params.status] - Filter by status
 * @returns {Promise<PaginationResult<User>>}
 */
export async function listByOrganization({organizationId, query = {}, status}) {
  let queriedRef = collection.where('organizationId', '==', organizationId);

  if (status) {
    queriedRef = queriedRef.where('status', '==', status);
  }

  const {sortField, direction} = getOrderBy(query.order || 'createdAt_desc');
  queriedRef = queriedRef.orderBy(sortField, direction);

  return paginateQuery({queriedRef, collection, query});
}

/**
 * List active users (for assignment dropdowns)
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<User[]>}
 */
export async function listActiveUsers(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .orderBy('name', 'asc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Update user
 *
 * @param {string} id - User ID
 * @param {Partial<User>} data - Fields to update
 * @returns {Promise<User>}
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
  delete updateData.passwordHash;

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Update user password
 *
 * @param {string} id - User ID
 * @param {string} passwordHash - New hashed password
 * @returns {Promise<void>}
 */
export async function updatePassword(id, passwordHash) {
  await collection.doc(id).update({
    passwordHash,
    updatedAt: FieldValue.serverTimestamp()
  });
}

/**
 * Update user notification preferences
 *
 * @param {string} id - User ID
 * @param {Partial<UserNotificationPreferences>} preferences - Preferences to update
 * @returns {Promise<User>}
 */
export async function updateNotificationPreferences(id, preferences) {
  const updateData = {};
  Object.keys(preferences).forEach(key => {
    updateData[`notificationPreferences.${key}`] = preferences[key];
  });
  updateData.updatedAt = FieldValue.serverTimestamp();

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Update last login timestamp
 *
 * @param {string} id - User ID
 * @returns {Promise<void>}
 */
export async function updateLastLogin(id) {
  await collection.doc(id).update({
    lastLoginAt: FieldValue.serverTimestamp()
  });
}

/**
 * Deactivate user (soft delete)
 *
 * @param {string} id - User ID
 * @returns {Promise<User>}
 */
export async function deactivate(id) {
  await collection.doc(id).update({
    status: 'deactivated',
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Reactivate user
 *
 * @param {string} id - User ID
 * @returns {Promise<User>}
 */
export async function reactivate(id) {
  await collection.doc(id).update({
    status: 'active',
    updatedAt: FieldValue.serverTimestamp()
  });
  return getById(id);
}

/**
 * Count users by organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>}
 */
export async function countByOrganization(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Get organization owner
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<User|null>}
 */
export async function getOwner(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('role', '==', 'owner')
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

export {collection, firestore};
