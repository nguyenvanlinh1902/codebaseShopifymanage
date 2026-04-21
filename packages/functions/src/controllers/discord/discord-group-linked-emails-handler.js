import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';

const authRepo = new GoogleAuthRepository();
const storeRepo = new StoreRepository();

/**
 * GET /api/discord/groups/:groupId/linked-emails
 *
 * Returns every Gmail/Outlook account known to the system, each annotated with
 * whether it is currently forwarded to this group (by any of three paths:
 * primary store, linkedStoreIds, or direct linkedGroupIds).
 *
 * Used by the "Linked Emails" tab in the group config UI to render the full
 * on/off matrix.
 */
export async function listGroupLinkedEmails(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;

    const all = await authRepo.getAll();
    const mailOnly = all.filter(a => a.authType === 'gmail' || a.authType === 'outlook');

    // Build a store → groupId map once for annotation.
    const storeIds = Array.from(new Set(mailOnly.flatMap(a => [
      a.storeId,
      ...(Array.isArray(a.linkedStoreIds) ? a.linkedStoreIds : [])
    ].filter(Boolean))));
    const stores = await storeRepo.getByIds(storeIds);
    const storeGroup = new Map(stores.map(s => [s.id, s.groupId || null]));

    // Deduplicate by googleEmail — one row per inbox regardless of how many
    // google_auth docs exist (one per linked store).
    const byEmail = new Map();
    for (const a of mailOnly) {
      if (!byEmail.has(a.googleEmail)) byEmail.set(a.googleEmail, a);
    }

    const rows = Array.from(byEmail.values()).map(a => {
      const linkedGroupIds = Array.isArray(a.linkedGroupIds) ? a.linkedGroupIds : [];
      const viaStore = storeGroup.get(a.storeId) === groupId;
      const viaLinkedStore = (a.linkedStoreIds || []).some(sid => storeGroup.get(sid) === groupId);
      const viaLinkedGroup = linkedGroupIds.includes(groupId);
      return {
        email: a.googleEmail,
        authType: a.authType,
        storeId: a.storeId,
        storeName: stores.find(s => s.id === a.storeId)?.name || null,
        viaStore,
        viaLinkedStore,
        viaLinkedGroup,
        isLinked: viaStore || viaLinkedStore || viaLinkedGroup,
        // Only linkedGroupIds is editable here — the others are derived.
        canUnlink: viaLinkedGroup && !viaStore && !viaLinkedStore
      };
    });

    rows.sort((a, b) => a.email.localeCompare(b.email));
    return res.json({success: true, data: rows});
  } catch (error) {
    console.error('[Discord:GroupLinkedEmails:List]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * PUT /api/discord/groups/:groupId/linked-emails
 * Body: { emails: string[] }  — the desired linked set (direct linkedGroupIds only).
 *
 * Adds groupId to linkedGroupIds for every email in the list that isn't
 * already there, and removes it from every email not in the list. Does NOT
 * affect store-derived membership (those are controlled via store.groupId).
 */
export async function setGroupLinkedEmails(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const {emails} = req.body;
    if (!Array.isArray(emails)) {
      return res.status(400).json({success: false, error: 'emails must be an array'});
    }

    const desired = new Set(emails);
    const current = await authRepo.getByLinkedGroup(groupId);
    const currentEmails = new Set(current.map(a => a.googleEmail));

    const toAdd = [...desired].filter(e => !currentEmails.has(e));
    const toRemove = [...currentEmails].filter(e => !desired.has(e));

    for (const email of toAdd) {
      await authRepo.addLinkedGroup(email, groupId);
    }
    for (const email of toRemove) {
      await authRepo.removeLinkedGroup(email, groupId);
    }

    return res.json({
      success: true,
      data: {added: toAdd.length, removed: toRemove.length}
    });
  } catch (error) {
    console.error('[Discord:GroupLinkedEmails:Set]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
