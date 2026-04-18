import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'gmail_watch';

/**
 * Gmail Watch Repository — tracks watch state per Gmail account
 * Follows GoogleAuthRepository lazy-getter pattern
 */
export class GmailWatchRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection(COLLECTION_NAME);
    return this._collection;
  }

  /**
   * Get watch record by email
   */
  async getByEmail(googleEmail) {
    const snapshot = await this.collection
      .where('googleEmail', '==', googleEmail)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * Get all active watch records
   */
  async getAllActive() {
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get watches expiring within N hours
   */
  async getAllExpiringSoon(hoursAhead = 48) {
    const cutoff = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .where('watchExpiration', '<', cutoff)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get all watch records for a store + user
   */
  async getAllByStoreAndUser(storeId, userId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get all watch records for a store (admin — all users)
   */
  async getAllByStore(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Create or update watch record
   */
  async upsertWatch(googleEmail, storeId, userId, watchData) {
    const existing = await this.getByEmail(googleEmail);
    const now = new Date().toISOString();

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...watchData,
        storeId,
        userId,
        updatedAt: now
      });
      return this.getByEmail(googleEmail);
    }

    const docRef = await this.collection.add({
      googleEmail,
      storeId,
      userId,
      ...watchData,
      createdAt: now,
      updatedAt: now
    });
    return {id: docRef.id, googleEmail, storeId, userId, ...watchData};
  }

  /**
   * Update historyId for a watch record
   */
  async updateHistoryId(googleEmail, historyId) {
    const existing = await this.getByEmail(googleEmail);
    if (!existing) return;
    await this.collection.doc(existing.id).update({
      historyId,
      lastSyncTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Update watch status
   */
  async updateStatus(googleEmail, status, renewalError = null) {
    const existing = await this.getByEmail(googleEmail);
    if (!existing) return;
    const update = {status, updatedAt: new Date().toISOString()};
    if (renewalError !== null) update.renewalError = renewalError;
    await this.collection.doc(existing.id).update(update);
  }
}
