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
   * Get first auth record by userId (backward compat)
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
   * Get ALL auth records for a user (multi-account)
   */
  async getAllByUserId(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get auth record by userId + googleEmail
   */
  async getByUserIdAndEmail(userId, googleEmail) {
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
   * Create or update auth record for a user (legacy — single account)
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
   * Create or update auth record by userId + googleEmail (multi-account)
   */
  async upsertByEmail(userId, googleEmail, tokenData) {
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
   * Delete auth record by userId + googleEmail
   */
  async deleteByEmail(userId, googleEmail) {
    const existing = await this.getByUserIdAndEmail(userId, googleEmail);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }

  /**
   * Delete auth record for a user (legacy)
   */
  async delete(userId) {
    const existing = await this.getByUserId(userId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }
}
