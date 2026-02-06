import {getFirestore} from 'firebase-admin/firestore';

/**
 * Product Repository
 * Stores imported products for tracking and management
 */
export class ProductRepository {
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
      this._collection = this.db.collection('products');
    }
    return this._collection;
  }

  /**
   * Save imported product
   */
  async save(productData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...productData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get products by store
   */
  async getByStore(storeId, limit = 100) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get products by user
   */
  async getByUser(userId, limit = 100) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get products by import ID
   */
  async getByImportId(importId) {
    const snapshot = await this.collection
      .where('importId', '==', importId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get product by Shopify ID
   */
  async getByShopifyId(storeId, shopifyProductId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('shopifyProductId', '==', shopifyProductId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }

  /**
   * Update product
   */
  async update(productId, updates) {
    await this.collection.doc(productId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Delete product
   */
  async delete(productId) {
    await this.collection.doc(productId).delete();
  }

  /**
   * Get products count by store
   */
  async getCountByStore(storeId) {
    const snapshot = await this.collection.where('storeId', '==', storeId).count().get();

    return snapshot.data().count;
  }

  /**
   * Get products count by import
   */
  async getCountByImport(importId) {
    const snapshot = await this.collection.where('importId', '==', importId).count().get();

    return snapshot.data().count;
  }

  /**
   * Search products by title or SKU
   */
  async search(storeId, query, limit = 50) {
    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or Elasticsearch
    const titleSnapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('title', '>=', query)
      .where('title', '<=', query + '\uf8ff')
      .limit(limit)
      .get();

    const products = titleSnapshot.docs.map(doc => doc.data());

    // Also search by SKU if not enough results
    if (products.length < limit) {
      const skuSnapshot = await this.collection
        .where('storeId', '==', storeId)
        .where('sku', '>=', query)
        .where('sku', '<=', query + '\uf8ff')
        .limit(limit - products.length)
        .get();

      const skuProducts = skuSnapshot.docs.map(doc => doc.data());
      products.push(...skuProducts.filter(p => !products.some(existing => existing.id === p.id)));
    }

    return products;
  }
}
