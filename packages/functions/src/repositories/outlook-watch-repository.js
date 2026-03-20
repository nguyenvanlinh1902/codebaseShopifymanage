import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'outlook_watch';

/**
 * Outlook Watch Repository — tracks subscription state per Outlook account
 * Mirrors GmailWatchRepository pattern
 */
export class OutlookWatchRepository {
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

  async getByEmail(email) {
    const snapshot = await this.collection
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async getBySubscriptionId(subscriptionId) {
    const snapshot = await this.collection
      .where('subscriptionId', '==', subscriptionId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async getAllActive() {
    const snapshot = await this.collection.where('status', '==', 'active').get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async getAllExpiringSoon(hoursAhead = 48) {
    const cutoff = new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .where('watchExpiration', '<', cutoff)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async getAllByStoreAndUser(storeId, userId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async upsertWatch(email, storeId, userId, watchData) {
    const existing = await this.getByEmail(email);
    const now = new Date().toISOString();

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...watchData,
        storeId,
        userId,
        updatedAt: now
      });
      return this.getByEmail(email);
    }

    const docRef = await this.collection.add({
      email,
      storeId,
      userId,
      ...watchData,
      createdAt: now,
      updatedAt: now
    });
    return {id: docRef.id, email, storeId, userId, ...watchData};
  }

  async updateStatus(email, status, renewalError = null) {
    const existing = await this.getByEmail(email);
    if (!existing) return;
    const update = {status, updatedAt: new Date().toISOString()};
    if (renewalError !== null) update.renewalError = renewalError;
    await this.collection.doc(existing.id).update(update);
  }
}
