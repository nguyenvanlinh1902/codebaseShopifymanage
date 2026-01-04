import {Firestore} from '@google-cloud/firestore';
import {formatDateFields} from '@avada/firestore-utils';

const firestore = new Firestore();
/** @type CollectionReference */
const collection = firestore.collection('shops');

/**
 *
 * @param {string} id
 * @returns {Promise<any>}
 */
export async function getShopById(id) {
  const doc = await collection.doc(id).get();
  return {id: doc.id, ...formatDateFields(doc.data())};
}

/**
 * Get shop by Shopify domain
 * Used for store linking by domain
 *
 * @param {string} shopifyDomain - Shopify domain (e.g., 'store.myshopify.com')
 * @returns {Promise<Shop|null>}
 */
export async function getShopByShopifyDomain(shopifyDomain) {
  try {
    return await getShopByField(shopifyDomain, 'shopifyDomain');
  } catch (error) {
    console.error('Error getting shop by Shopify domain:', error);
    return null;
  }
}

/**
 * Get shop by field
 *
 * @param {string} value
 * @param {string} field
 * @returns {Promise<Shop|*>}
 */
export async function getShopByField(value, field = 'shopifyDomain') {
  const docs = await collection
    .where(field, '==', value)
    .limit(1)
    .get();

  if (docs.docs.length === 0) {
    return null;
  }

  const doc = docs.docs[0];
  return {id: doc.id, ...formatDateFields(doc.data())};
}
