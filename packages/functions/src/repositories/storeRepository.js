import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'shopify_stores';

/**
 * Store Repository
 * Manages Shopify store configurations in Firestore
 */
export class StoreRepository {
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
   * Create a new store
   */
  async create(storeData) {
    const docRef = await this.collection.add({
      ...storeData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      id: docRef.id,
      ...storeData
    };
  }

  /**
   * Get store by ID
   */
  async getById(storeId) {
    const doc = await this.collection.doc(storeId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  /**
   * Get all stores for a user
   */
  async getByUserId(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Alias for getByUserId
   */
  async getByUser(userId) {
    return this.getByUserId(userId);
  }

  /**
   * Get all stores
   */
  async getAll() {
    const snapshot = await this.collection.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Update store
   */
  async update(storeId, updateData) {
    await this.collection.doc(storeId).update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return this.getById(storeId);
  }

  /**
   * Delete store
   */
  async delete(storeId) {
    await this.collection.doc(storeId).delete();
  }

  /**
   * Get store by shop domain
   */
  async getByShopDomain(shopDomain) {
    const snapshot = await this.collection.where('shopDomain', '==', shopDomain).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  }
}
