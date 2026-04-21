import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {extractStoreIds} from '../utils/store-access.js';

const userRepo = new AdminUserRepository();
const authRepo = new GoogleAuthRepository();
const storeRepo = new StoreRepository();

/**
 * Resolve the set of storeIds the requester may act within.
 * - Admin: all existing store IDs
 * - Staff/Manager: only those in `assignedStores`
 *
 * Returns an array. Admin callers get `null` sentinel to signal "unrestricted"
 * so callers can short-circuit before running an expensive getAll().
 */
export async function getAccessibleStoreIds(req) {
  if (req.userRole === 'admin') return null; // sentinel — unrestricted
  const user = await userRepo.getById(req.userId);
  return extractStoreIds(user?.assignedStores);
}

/**
 * Throw 403 unless the requester can access the store that owns `accountEmail`
 * (including via `linkedStoreIds`).
 *
 * Admins always pass. Non-admin must have overlap between their assignedStores
 * and the account's [storeId, ...linkedStoreIds] union.
 */
export async function assertEmailAccess(req, accountEmail) {
  if (!accountEmail) {
    const err = new Error('email is required');
    err.status = 400;
    throw err;
  }
  if (req.userRole === 'admin') return;

  const accessible = await getAccessibleStoreIds(req);
  if (!accessible || accessible.length === 0) {
    const err = new Error('Forbidden: no store access');
    err.status = 403;
    throw err;
  }

  // Find any auth record for this email across all the caller's stores.
  // Firestore `in` is capped at 30 values — chunk if needed.
  const chunks = chunkArray(accessible, 30);
  for (const chunk of chunks) {
    const snap = await authRepo.collection
      .where('storeId', 'in', chunk)
      .where('googleEmail', '==', accountEmail)
      .limit(1)
      .get();
    if (!snap.empty) return;
  }

  // Also honor linkedStoreIds and linkedGroupIds — caller may own a sibling
  // store or a group the account is directly linked to.
  const records = await authRepo.collection
    .where('googleEmail', '==', accountEmail)
    .get();
  const accessibleGroups = await deriveGroupIdsForStores(accessible);
  for (const doc of records.docs) {
    const data = doc.data();
    const linkedStores = Array.isArray(data.linkedStoreIds) ? data.linkedStoreIds : [];
    const storeUnion = new Set([data.storeId, ...linkedStores].filter(Boolean));
    if (accessible.some(id => storeUnion.has(id))) return;
    const linkedGroups = Array.isArray(data.linkedGroupIds) ? data.linkedGroupIds : [];
    if (linkedGroups.some(g => accessibleGroups.has(g))) return;
  }

  const err = new Error('Forbidden: account not in your assigned stores');
  err.status = 403;
  throw err;
}

/**
 * Helper: filter a list of auth records down to those the requester can see.
 * Admin sees all. Non-admin sees records where any of the following overlaps
 * their assignedStores / derived groups:
 *   - account.storeId
 *   - account.linkedStoreIds
 *   - account.linkedGroupIds (matched against the groups derived from assignedStores)
 */
export async function filterAccountsByAccess(req, accounts) {
  if (req.userRole === 'admin') return accounts;
  const accessible = await getAccessibleStoreIds(req);
  if (!accessible || accessible.length === 0) return [];
  const accSet = new Set(accessible);

  // Compute the groups the caller can see via their assigned stores.
  const accessibleGroups = await deriveGroupIdsForStores(accessible);

  return accounts.filter(a => {
    if (accSet.has(a.storeId)) return true;
    const linkedStores = Array.isArray(a.linkedStoreIds) ? a.linkedStoreIds : [];
    if (linkedStores.some(id => accSet.has(id))) return true;
    const linkedGroups = Array.isArray(a.linkedGroupIds) ? a.linkedGroupIds : [];
    return linkedGroups.some(g => accessibleGroups.has(g));
  });
}

async function deriveGroupIdsForStores(storeIds) {
  const out = new Set();
  if (!storeIds || storeIds.length === 0) return out;
  const stores = await storeRepo.getByIds(storeIds);
  for (const s of stores) {
    if (s.groupId) out.add(s.groupId);
  }
  return out;
}

/**
 * Enrich accounts with store/group labels for UI display.
 */
export async function enrichAccountsWithStoreLabels(accounts) {
  const storeIds = Array.from(new Set(accounts.map(a => a.storeId).filter(Boolean)));
  if (storeIds.length === 0) return accounts.map(a => ({...a, storeName: null, groupId: null}));
  const stores = await storeRepo.getByIds(storeIds);
  const byId = new Map(stores.map(s => [s.id, s]));
  return accounts.map(a => {
    const store = byId.get(a.storeId);
    return {
      ...a,
      storeName: store?.name || store?.shopDomain || null,
      groupId: store?.groupId || null
    };
  });
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
