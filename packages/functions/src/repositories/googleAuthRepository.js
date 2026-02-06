import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'google_auth';

/**
 * Google Auth Repository
 * Manages per-user Google OAuth tokens in Firestore
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
   * Get auth record by userId
   */
  async getByUserId(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * Create or update auth record for a user
   */
  async upsert(userId, tokenData) {
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
   * Delete auth record for a user
   */
  async delete(userId) {
    const existing = await this.getByUserId(userId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }
}
