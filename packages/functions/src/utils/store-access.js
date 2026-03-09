/**
 * Helpers for assignedStores which supports both formats:
 *   Legacy: string[]         e.g. ["docId1", "docId2"]
 *   Current: {id, shopDomain}[] e.g. [{id:"docId1", shopDomain:"store1.myshopify.com"}]
 */

/** Extract Firestore document IDs from assignedStores (either format). */
export function extractStoreIds(assignedStores) {
  return (assignedStores || []).map(s => (typeof s === 'string' ? s : s.id));
}

/** Check if a given storeId is in the user's assigned stores. */
export function hasStoreAccess(assignedStores, storeId) {
  return extractStoreIds(assignedStores).includes(storeId);
}
