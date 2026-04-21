import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'google_auth';

/**
 * Google Auth Repository
 * Manages per-user Google OAuth tokens in Firestore (multi-account)
 */
export class GoogleAuthRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }

  get collection() {
    if (!this._collection) {
      this._collection = this.db.collection(COLLECTION_NAME);
    }
    return this._collection;
  }

  /**
   * SECURITY: Get first auth record by storeId + userId
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   */
  async getByStoreAndUser(storeId, userId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * Get first auth record by userId (backward compat)
   * @deprecated Use getByStoreAndUser for proper data isolation
   */
  async getByUserId(userId) {
    console.warn('[GoogleAuthRepository] getByUserId is deprecated - use getByStoreAndUser');
    const snapshot = await this.collection.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * SECURITY: Get ALL auth records for a store + user (multi-account)
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   */
  async getAllByStoreAndUser(storeId, userId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get ALL auth records for a store (admin use — all users)
   */
  async getAllByStore(storeId) {
    const snapshot = await this.collection.where('storeId', '==', storeId).get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get ALL auth records for a user (multi-account)
   * @deprecated Use getAllByStoreAndUser for proper data isolation
   */
  async getAllByUserId(userId) {
    console.warn('[GoogleAuthRepository] getAllByUserId is deprecated - use getAllByStoreAndUser');
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get auth record by storeId + googleEmail (admin — no userId filter)
   */
  async getByStoreAndEmail(storeId, googleEmail) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('googleEmail', '==', googleEmail)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * SECURITY: Get auth record by storeId + userId + googleEmail
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   * @param {string} googleEmail - Google email address
   */
  async getByStoreUserAndEmail(storeId, userId, googleEmail) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .where('googleEmail', '==', googleEmail)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * Get auth record by userId + googleEmail
   * @deprecated Use getByStoreUserAndEmail for proper data isolation
   */
  async getByUserIdAndEmail(userId, googleEmail) {
    console.warn(
      '[GoogleAuthRepository] getByUserIdAndEmail is deprecated - use getByStoreUserAndEmail'
    );
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('googleEmail', '==', googleEmail)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * SECURITY: Create or update auth record with store isolation
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   * @param {object} tokenData - Token data to store
   */
  async upsertByStore(storeId, userId, tokenData) {
    const existing = await this.getByStoreAndUser(storeId, userId);

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...tokenData,
        updatedAt: new Date().toISOString()
      });
      return this.getByStoreAndUser(storeId, userId);
    }

    const docRef = await this.collection.add({
      storeId,
      userId,
      ...tokenData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {id: docRef.id, storeId, userId, ...tokenData};
  }

  /**
   * Create or update auth record for a user (legacy — single account)
   * @deprecated Use upsertByStore for proper data isolation
   */
  async upsert(userId, tokenData) {
    console.warn('[GoogleAuthRepository] upsert is deprecated - use upsertByStore');
    const existing = await this.getByUserId(userId);

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...tokenData,
        updatedAt: new Date().toISOString()
      });
      return this.getByUserId(userId);
    }

    const docRef = await this.collection.add({
      userId,
      ...tokenData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {id: docRef.id, userId, ...tokenData};
  }

  /**
   * SECURITY: Create or update auth record by store + user + email (multi-account)
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   * @param {string} googleEmail - Google email address
   * @param {object} tokenData - Token data to store
   */
  async upsertByStoreAndEmail(storeId, userId, googleEmail, tokenData) {
    const existing = await this.getByStoreUserAndEmail(storeId, userId, googleEmail);

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...tokenData,
        googleEmail,
        updatedAt: new Date().toISOString()
      });
      const updated = await this.getByStoreUserAndEmail(storeId, userId, googleEmail);
      return updated;
    }

    const docRef = await this.collection.add({
      storeId,
      userId,
      googleEmail,
      ...tokenData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {id: docRef.id, storeId, userId, googleEmail, ...tokenData};
  }

  /**
   * Create or update auth record by userId + googleEmail (multi-account)
   * @deprecated Use upsertByStoreAndEmail for proper data isolation
   */
  async upsertByEmail(userId, googleEmail, tokenData) {
    console.warn('[GoogleAuthRepository] upsertByEmail is deprecated - use upsertByStoreAndEmail');
    const existing = await this.getByUserIdAndEmail(userId, googleEmail);

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...tokenData,
        googleEmail,
        updatedAt: new Date().toISOString()
      });
      const updated = await this.getByUserIdAndEmail(userId, googleEmail);
      return updated;
    }

    const docRef = await this.collection.add({
      userId,
      googleEmail,
      ...tokenData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {id: docRef.id, userId, googleEmail, ...tokenData};
  }

  /**
   * SECURITY: Delete auth record by store + user + email
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   * @param {string} googleEmail - Google email address
   */
  async deleteByStoreAndEmail(storeId, userId, googleEmail) {
    const existing = await this.getByStoreUserAndEmail(storeId, userId, googleEmail);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }

  /**
   * Delete auth record by userId + googleEmail
   * @deprecated Use deleteByStoreAndEmail for proper data isolation
   */
  async deleteByEmail(userId, googleEmail) {
    console.warn('[GoogleAuthRepository] deleteByEmail is deprecated - use deleteByStoreAndEmail');
    const existing = await this.getByUserIdAndEmail(userId, googleEmail);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }

  /**
   * SECURITY: Delete auth record by store + user
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   */
  async deleteByStore(storeId, userId) {
    const existing = await this.getByStoreAndUser(storeId, userId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }

  /**
   * Update linkedStoreIds for an email account (by storeId + googleEmail).
   * @param {string} storeId - Store ID
   * @param {string} googleEmail - Email address
   * @param {string[]} linkedStoreIds - Array of store IDs to link
   */
  async updateLinkedStores(storeId, googleEmail, linkedStoreIds) {
    const existing = await this.getByStoreAndEmail(storeId, googleEmail);
    if (!existing) throw new Error(`Account not found: ${googleEmail}`);
    await this.collection.doc(existing.id).update({
      linkedStoreIds: linkedStoreIds || [],
      updatedAt: new Date().toISOString()
    });
    return {id: existing.id, linkedStoreIds};
  }

  /**
   * Find the first auth record for an email address (any storeId).
   */
  async getFirstByEmail(googleEmail) {
    const snap = await this.collection
      .where('googleEmail', '==', googleEmail)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return {id: snap.docs[0].id, ...snap.docs[0].data()};
  }

  /**
   * Add a groupId to the linkedGroupIds array of every doc for `googleEmail`.
   * Idempotent. Returns count updated.
   */
  async addLinkedGroup(googleEmail, groupId) {
    const snap = await this.collection.where('googleEmail', '==', googleEmail).get();
    if (snap.empty) return 0;
    const batch = this.db.batch();
    let touched = 0;
    for (const doc of snap.docs) {
      const list = Array.isArray(doc.data().linkedGroupIds) ? doc.data().linkedGroupIds : [];
      if (list.includes(groupId)) continue;
      batch.update(doc.ref, {
        linkedGroupIds: [...list, groupId],
        updatedAt: new Date().toISOString()
      });
      touched++;
    }
    if (touched > 0) await batch.commit();
    return touched;
  }

  /**
   * Remove a groupId from linkedGroupIds on every doc for `googleEmail`.
   * Idempotent. Returns count updated.
   */
  async removeLinkedGroup(googleEmail, groupId) {
    const snap = await this.collection.where('googleEmail', '==', googleEmail).get();
    if (snap.empty) return 0;
    const batch = this.db.batch();
    let touched = 0;
    for (const doc of snap.docs) {
      const list = Array.isArray(doc.data().linkedGroupIds) ? doc.data().linkedGroupIds : [];
      if (!list.includes(groupId)) continue;
      batch.update(doc.ref, {
        linkedGroupIds: list.filter(g => g !== groupId),
        updatedAt: new Date().toISOString()
      });
      touched++;
    }
    if (touched > 0) await batch.commit();
    return touched;
  }

  /**
   * Find all auth records whose linkedGroupIds include `groupId`.
   * Returns deduped-by-googleEmail list (first record wins for display).
   */
  async getByLinkedGroup(groupId) {
    const snap = await this.collection
      .where('linkedGroupIds', 'array-contains', groupId)
      .get();
    const byEmail = new Map();
    for (const d of snap.docs) {
      const data = {id: d.id, ...d.data()};
      if (!byEmail.has(data.googleEmail)) byEmail.set(data.googleEmail, data);
    }
    return Array.from(byEmail.values());
  }

  /**
   * Get ALL auth records (no filter)
   */
  async getAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Delete auth record for a user (legacy)
   * @deprecated Use deleteByStore for proper data isolation
   */
  async delete(userId) {
    console.warn('[GoogleAuthRepository] delete is deprecated - use deleteByStore');
    const existing = await this.getByUserId(userId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }
}
