import {getFirestore} from 'firebase-admin/firestore';

/**
 * Import History Repository
 * Manages product import jobs and their results
 */
export class ImportHistoryRepository {
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
      this._collection = this.db.collection('product_imports');
    }
    return this._collection;
  }

  /**
   * Create a new import job
   */
  async create(importData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...importData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get import by ID
   */
  async getById(importId) {
    const doc = await this.collection.doc(importId).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Get all imports for a store
   */
  async getByStore(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get all imports for a user
   */
  async getByUser(userId) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Update import progress
   */
  async updateProgress(importId, updates) {
    await this.collection.doc(importId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Mark import as completed
   */
  async markCompleted(importId, results) {
    await this.collection.doc(importId).update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      results,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Mark import as failed
   */
  async markFailed(importId, error) {
    await this.collection.doc(importId).update({
      status: 'failed',
      error: error.message || error,
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get all imports (no userId filter, for standalone admin)
   */
  async getAll(limit = 100) {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get recent successful imports
   */
  async getRecentSuccessful(userId, limit = 10) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get all recent successful imports (no userId filter, for standalone admin)
   */
  async getAllRecentSuccessful(limit = 20) {
    const snapshot = await this.collection
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Update individual product status within an import job
   */
  async updateProductStatus(importId, productIndex, status, error = null) {
    const doc = await this.collection.doc(importId).get();
    if (!doc.exists) return;

    const data = doc.data();
    const products = data.products || [];

    if (productIndex < products.length) {
      products[productIndex].status = status;
      if (error) products[productIndex].error = error;
      products[productIndex].updatedAt = new Date().toISOString();

      await this.collection.doc(importId).update({
        products,
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Get active/recent import jobs (processing or recently completed)
   */
  async getActiveImports(storeId, limit = 5) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('status', 'in', ['pending', 'processing'])
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get all active import jobs across all stores (for standalone admin)
   */
  async getAllActiveImports(limit = 20) {
    const snapshot = await this.collection
      .where('status', 'in', ['pending', 'processing'])
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Save grouped products to Firestore subcollection (avoids PubSub size limits).
   * Each product is stored as a separate doc: product_imports/{importId}/import_products/{index}
   */
  async saveImportProducts(importId, products) {
    const batch = this.db.batch();
    const subCol = this.collection.doc(importId).collection('import_products');

    for (let i = 0; i < products.length; i++) {
      const docRef = subCol.doc(String(i));
      batch.set(docRef, {index: i, ...products[i]});
    }

    await batch.commit();
  }

  /**
   * Get a single import product by index from subcollection
   */
  async getImportProduct(importId, index) {
    const doc = await this.collection
      .doc(importId)
      .collection('import_products')
      .doc(String(index))
      .get();

    return doc.exists ? doc.data() : null;
  }

  /**
   * Get all import products for a job (ordered by index)
   */
  async getImportProducts(importId) {
    const snapshot = await this.collection
      .doc(importId)
      .collection('import_products')
      .orderBy('index')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }
}
