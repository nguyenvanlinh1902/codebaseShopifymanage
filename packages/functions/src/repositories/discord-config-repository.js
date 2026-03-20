import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_config';

/**
 * Discord Config Repository — stores bot token + channel config per store
 * Follows GoogleAuthRepository lazy-getter pattern
 */
export class DiscordConfigRepository {
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
   * Get config by storeId
   */
  async getByStoreId(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  /**
   * Create or update config
   */
  async upsert(storeId, configData) {
    const existing = await this.getByStoreId(storeId);
    const now = new Date().toISOString();

    if (existing) {
      await this.collection.doc(existing.id).update({
        ...configData,
        updatedAt: now
      });
      return this.getByStoreId(storeId);
    }

    const docRef = await this.collection.add({
      storeId,
      ...configData,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    return {id: docRef.id, storeId, ...configData, isActive: true};
  }

  /**
   * Delete config
   */
  async delete(storeId) {
    const existing = await this.getByStoreId(storeId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }
}
