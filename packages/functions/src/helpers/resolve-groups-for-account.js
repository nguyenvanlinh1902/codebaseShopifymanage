import {StoreRepository} from '../repositories/storeRepository.js';

/**
 * Resolve which groups an email account should fan-out to.
 *
 * An account belongs to a group through ANY of these paths:
 *   1. Primary `storeId` → `store.groupId`
 *   2. `linkedStoreIds[]` → each store's `groupId`
 *   3. `linkedGroupIds[]` — direct group assignment (admin-managed)
 *
 * Ungrouped stores contribute nothing. Direct `linkedGroupIds` contribute even
 * if the account has no store in that group — this is the main use case for
 * assigning a support inbox to multiple groups without touching stores.
 *
 * @param {{storeId: string, linkedStoreIds?: string[], linkedGroupIds?: string[]}} account
 * @returns {Promise<string[]>} array of unique groupIds (no nulls)
 */
export async function resolveGroupIdsForAccount(account) {
  const groupIds = new Set();

  // Direct group links (no store hop).
  for (const gid of account.linkedGroupIds || []) {
    if (gid) groupIds.add(gid);
  }

  // Indirect via stores.
  const storeIds = Array.from(new Set([
    account.storeId,
    ...(account.linkedStoreIds || [])
  ].filter(Boolean)));

  if (storeIds.length > 0) {
    const storeRepo = new StoreRepository();
    const stores = await storeRepo.getByIds(storeIds);
    for (const s of stores) {
      if (s.groupId) groupIds.add(s.groupId);
    }
  }

  return Array.from(groupIds);
}
