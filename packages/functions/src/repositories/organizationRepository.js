import {Firestore, FieldValue} from '@google-cloud/firestore';
import {formatDateFields} from '@avada/firestore-utils';
import {prepareDoc} from './helper';

const firestore = new Firestore();
/** @type {FirebaseFirestore.CollectionReference} */
const collection = firestore.collection('organizations');

/**
 * Create a new organization
 *
 * @param {Object} data - Organization data
 * @param {string} data.name - Organization name
 * @param {string} data.shopifyDomain - Shopify domain
 * @param {string} data.shopId - Reference to shops collection
 * @param {string} data.emailAddress - Unique forwarding email address
 * @param {string} [data.timezone='UTC'] - Timezone
 * @returns {Promise<Organization>}
 */
export async function create(data) {
  const now = FieldValue.serverTimestamp();
  const organizationData = {
    name: data.name,
    shopifyDomain: data.shopifyDomain,
    shopId: data.shopId,
    emailAddress: data.emailAddress,
    timezone: data.timezone || 'UTC',
    settings: {
      supportEmailName: data.name + ' Support',
      emailSignature: '',
      replyToEmail: '',
      autoCloseAfterDays: 7
    },
    onboardingStatus: {
      accountCreated: true,
      shopifyConnected: false,
      emailConfigured: false,
      teamInvited: false,
      testEmailSent: false
    },
    createdAt: now,
    updatedAt: now
  };

  const docRef = await collection.add(organizationData);
  const doc = await docRef.get();
  return prepareDoc({doc});
}

/**
 * Get organization by ID
 *
 * @param {string} id - Organization ID
 * @returns {Promise<Organization|null>}
 */
export async function getById(id) {
  const doc = await collection.doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return prepareDoc({doc});
}

/**
 * Get organization by shop ID
 *
 * @param {string} shopId - Shop ID from shops collection
 * @returns {Promise<Organization|null>}
 */
export async function getByShopId(shopId) {
  const snapshot = await collection.where('shopId', '==', shopId).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get organization by Shopify domain
 *
 * @param {string} shopifyDomain - Shopify domain (e.g., 'store.myshopify.com')
 * @returns {Promise<Organization|null>}
 */
export async function getByShopifyDomain(shopifyDomain) {
  const snapshot = await collection.where('shopifyDomain', '==', shopifyDomain).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Get organization by email address (forwarding address)
 *
 * @param {string} emailAddress - Unique forwarding email address
 * @returns {Promise<Organization|null>}
 */
export async function getByEmailAddress(emailAddress) {
  const snapshot = await collection.where('emailAddress', '==', emailAddress).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  return prepareDoc({doc: snapshot.docs[0]});
}

/**
 * Update organization
 *
 * @param {string} id - Organization ID
 * @param {Partial<Organization>} data - Fields to update
 * @returns {Promise<Organization>}
 */
export async function update(id, data) {
  const updateData = {
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  };
  // Remove fields that shouldn't be updated directly
  delete updateData.id;
  delete updateData.createdAt;
  delete updateData.shopId;

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Update organization settings
 *
 * @param {string} id - Organization ID
 * @param {Partial<OrganizationSettings>} settings - Settings to update
 * @returns {Promise<Organization>}
 */
export async function updateSettings(id, settings) {
  const updateData = {};
  Object.keys(settings).forEach(key => {
    updateData[`settings.${key}`] = settings[key];
  });
  updateData.updatedAt = FieldValue.serverTimestamp();

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Update onboarding status
 *
 * @param {string} id - Organization ID
 * @param {Partial<OnboardingStatus>} status - Status fields to update
 * @returns {Promise<Organization>}
 */
export async function updateOnboardingStatus(id, status) {
  const updateData = {};
  Object.keys(status).forEach(key => {
    updateData[`onboardingStatus.${key}`] = status[key];
  });
  updateData.updatedAt = FieldValue.serverTimestamp();

  await collection.doc(id).update(updateData);
  return getById(id);
}

/**
 * Store encrypted Shopify token
 *
 * @param {string} id - Organization ID
 * @param {string} encryptedToken - Encrypted access token
 * @returns {Promise<void>}
 */
export async function storeShopifyToken(id, encryptedToken) {
  await collection.doc(id).update({
    shopifyToken: encryptedToken,
    'onboardingStatus.shopifyConnected': true,
    updatedAt: FieldValue.serverTimestamp()
  });
}

/**
 * Delete organization (soft delete not implemented for MVP - use with caution)
 *
 * @param {string} id - Organization ID
 * @returns {Promise<void>}
 */
export async function remove(id) {
  await collection.doc(id).delete();
}

export {collection, firestore};
