import {Firestore, FieldValue} from '@google-cloud/firestore';
import {prepareDoc} from './helper';
import crypto from 'crypto';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('invitations');

/**
 * Create a new invitation
 *
 * @param {Object} data - Invitation data
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.email - Invitee email
 * @param {'admin'|'agent'} data.role - Role to assign
 * @param {string} data.invitedBy - User ID who sent invitation
 * @param {number} [expiresInDays=7] - Days until expiration
 * @returns {Promise<Invitation>}
 */
export async function create(data, expiresInDays = 7) {
  const now = FieldValue.serverTimestamp();
  const normalizedEmail = data.email.toLowerCase().trim();

  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex');

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitationData = {
    organizationId: data.organizationId,
    email: normalizedEmail,
    role: data.role,
    invitedBy: data.invitedBy,
    token,
    expiresAt,
    status: 'pending',
    createdAt: now
  };

  const docRef = await collection.add(invitationData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get invitation by ID
 *
 * @param {string} id - Invitation ID
 * @returns {Promise<Invitation|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get invitation by token
 *
 * @param {string} token - Invitation token
 * @returns {Promise<Invitation|null>}
 */
export async function getByToken(token) {
  const snapshot = await collection.where('token', '==', token).limit(1).get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get pending invitation by email within an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {string} email - Invitee email
 * @returns {Promise<Invitation|null>}
 */
export async function getPendingByEmail(organizationId, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('email', '==', normalizedEmail)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * List pending invitations for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Invitation[]>}
 */
export async function listPendingByOrganization(organizationId) {
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Mark invitation as accepted
 *
 * @param {string} id - Invitation ID
 * @returns {Promise<Invitation>}
 */
export async function markAccepted(id) {
  await collection.doc(id).update({
    status: 'accepted'
  });
  return getById(id);
}

/**
 * Mark invitation as expired
 *
 * @param {string} id - Invitation ID
 * @returns {Promise<Invitation>}
 */
export async function markExpired(id) {
  await collection.doc(id).update({
    status: 'expired'
  });
  return getById(id);
}

/**
 * Delete invitation
 *
 * @param {string} id - Invitation ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

/**
 * Delete all pending invitations for an email (when user accepts one)
 *
 * @param {string} organizationId - Organization ID
 * @param {string} email - Email address
 * @returns {Promise<number>} Number of deleted invitations
 */
export async function deletePendingByEmail(organizationId, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const snapshot = await collection
    .where('organizationId', '==', organizationId)
    .where('email', '==', normalizedEmail)
    .where('status', '==', 'pending')
    .get();

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
 * Get expired invitations (for cleanup job)
 *
 * @param {number} [limit=100] - Max invitations to return
 * @returns {Promise<Invitation[]>}
 */
export async function getExpiredInvitations(limit = 100) {
  const now = new Date();
  const snapshot = await collection
    .where('status', '==', 'pending')
    .where('expiresAt', '<=', now)
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => prepareDoc({doc}));
}

/**
 * Validate invitation token
 *
 * @param {string} token - Invitation token
 * @returns {Promise<{valid: boolean, invitation: Invitation|null, error: string|null}>}
 */
export async function validateToken(token) {
  const invitation = await getByToken(token);

  if (!invitation) {
    return {valid: false, invitation: null, error: 'Invalid invitation token'};
  }

  if (invitation.status === 'accepted') {
    return {valid: false, invitation, error: 'Invitation has already been accepted'};
  }

  if (invitation.status === 'expired') {
    return {valid: false, invitation, error: 'Invitation has expired'};
  }

  // Check if expired by date
  const expiresAt = new Date(invitation.expiresAt);
  if (expiresAt < new Date()) {
    // Mark as expired
    await markExpired(invitation.id);
    return {valid: false, invitation, error: 'Invitation has expired'};
  }

  return {valid: true, invitation, error: null};
}

export {collection, firestore};
