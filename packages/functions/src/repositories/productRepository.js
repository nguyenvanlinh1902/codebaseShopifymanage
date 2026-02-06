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

  /**
   * Get products with pagination and search
   * @param {Object} options - Query options
   * @param {string} options.userId - User ID
   * @param {string} options.storeId - Store ID (optional)
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search query (optional)
   * @returns {Promise<{products: Array, total: number, page: number, totalPages: number}>}
   */
  async getWithPagination({userId, storeId, page = 1, limit = 50, search = ''}) {
    let query = this.collection;

    // Build base query
    if (storeId) {
      query = query.where('storeId', '==', storeId);
    } else if (userId) {
      query = query.where('userId', '==', userId);
    }

    // Get total count for the base query
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    // If search query exists, fetch all and filter client-side
    // (Firestore doesn't support full-text search natively)
    if (search) {
      const allSnapshot = await query.orderBy('createdAt', 'desc').get();
      const allProducts = allSnapshot.docs.map(doc => doc.data());

      // Filter by search query (case-insensitive)
      const searchLower = search.toLowerCase();
      const filteredProducts = allProducts.filter(
        p =>
          p.title?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.vendor?.toLowerCase().includes(searchLower) ||
          p.productType?.toLowerCase().includes(searchLower)
      );

      const filteredTotal = filteredProducts.length;
      const totalPages = Math.ceil(filteredTotal / limit);
      const offset = (page - 1) * limit;
      const paginatedProducts = filteredProducts.slice(offset, offset + limit);

      return {
        products: paginatedProducts,
        total: filteredTotal,
        page,
        limit,
        totalPages
      };
    }

    // No search: use Firestore pagination
    const offset = (page - 1) * limit;

    // Get documents with offset (fetch offset + limit, then skip first offset)
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(offset + limit)
      .get();

    const allDocs = snapshot.docs.map(doc => doc.data());
    const products = allDocs.slice(offset);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
