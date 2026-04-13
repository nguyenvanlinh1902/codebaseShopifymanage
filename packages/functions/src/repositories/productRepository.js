import {getFirestore} from 'firebase-admin/firestore';
import {queryBigQuery} from '../services/bigQueryService.js';
import bigQueryConfig from '../config/bigQuery.js';

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
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Get products count by import
   */
  async getCountByImport(importId) {
    const snapshot = await this.collection
      .where('importId', '==', importId)
      .count()
      .get();

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
   * Get products with Firestore pagination.
   * Access control:
   *   - permittedStoreIds = null → admin, no filter
   *   - permittedStoreIds = string[] → non-admin, filter by those stores
   *   - storeId → override: filter by single store (user-selected)
   */
  async getWithPagination({permittedStoreIds, storeId, status = '', page = 1, limit = 50}) {
    let query = this.collection;

    if (storeId) {
      // User selected a specific store — filter by it
      query = query.where('storeId', '==', storeId);
    } else if (permittedStoreIds !== null) {
      // Non-admin: filter by assigned stores (Firestore 'in' supports up to 30 values)
      const ids = permittedStoreIds.slice(0, 30);
      query = query.where('storeId', 'in', ids);
    }
    // else: admin (permittedStoreIds === null) — no filter, get all

    if (status) {
      query = query.where('status', '==', status);
    }

    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    const offset = (page - 1) * limit;
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(offset + limit)
      .get();

    const allDocs = snapshot.docs.map(doc => doc.data());
    const products = allDocs.slice(offset);

    return {products, total, page, limit, totalPages: Math.ceil(total / limit)};
  }

  /**
   * Search products using BigQuery (full-text search).
   * Access control:
   *   - permittedStoreIds = null → admin, no store filter
   *   - permittedStoreIds = string[] → non-admin, filter by those stores
   *   - storeId → user-selected single store override
   */
  async searchProducts({
    permittedStoreIds,
    storeId,
    search = '',
    vendors = [],
    stores = [],
    status = '',
    page = 1,
    limit = 50
  } = {}) {
    const dataset = bigQueryConfig.datasetId;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const params = {};

    // Access scope
    if (storeId) {
      whereConditions.push(`storeId = @storeId`);
      params.storeId = storeId;
    } else if (permittedStoreIds !== null) {
      // Non-admin: restrict to assigned stores
      if (permittedStoreIds.length === 0) {
        return {products: [], total: 0, page, limit, totalPages: 0};
      }
      whereConditions.push(`storeId IN UNNEST(@permittedStoreIds)`);
      params.permittedStoreIds = permittedStoreIds;
    }
    // else: admin (null) — no store restriction

    if (search) {
      whereConditions.push(
        `(LOWER(title) LIKE LOWER(@search) OR LOWER(sku) LIKE LOWER(@search) OR LOWER(vendor) LIKE LOWER(@search) OR LOWER(productType) LIKE LOWER(@search))`
      );
      params.search = `%${search}%`;
    }

    if (vendors.length > 0) {
      whereConditions.push(`vendor IN UNNEST(@vendors)`);
      params.vendors = vendors;
    }

    if (stores.length > 0) {
      whereConditions.push(`storeId IN UNNEST(@stores)`);
      params.stores = stores;
    }

    if (status) {
      whereConditions.push(`status = @status`);
      params.status = status;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(DISTINCT document_id) as count
      FROM \`${dataset}.products_latest_view\`
      ${whereClause}
    `;
    const countResult = await queryBigQuery(countQuery, params);
    const total = countResult.length > 0 ? countResult[0].count : 0;

    params.limit = limit;
    params.offset = offset;

    const dataQuery = `
      SELECT *
      FROM \`${dataset}.products_latest_view\`
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT @limit OFFSET @offset
    `;
    const products = await queryBigQuery(dataQuery, params);

    return {products, total, page, limit, totalPages: Math.ceil(total / limit)};
  }

  /**
   * Get filter options (distinct vendors and stores).
   * permittedStoreIds = null → admin (all), string[] → non-admin (assigned stores only)
   */
  async getFilterOptions(permittedStoreIds) {
    const dataset = bigQueryConfig.datasetId;

    // Build scope clause
    let scopeClause = '';
    const params = {};
    if (permittedStoreIds !== null) {
      if (permittedStoreIds.length === 0) return {vendors: [], stores: []};
      scopeClause = 'AND storeId IN UNNEST(@permittedStoreIds)';
      params.permittedStoreIds = permittedStoreIds;
    }

    const vendorQuery = `
      SELECT DISTINCT vendor
      FROM \`${dataset}.products_latest_view\`
      WHERE vendor IS NOT NULL ${scopeClause}
      ORDER BY vendor
    `;
    const vendors = await queryBigQuery(vendorQuery, params);
    const vendorList = vendors.map(v => v.vendor).filter(Boolean);

    const storeQuery = `
      SELECT DISTINCT storeId, storeName
      FROM \`${dataset}.products_latest_view\`
      WHERE TRUE ${scopeClause}
      ORDER BY storeName
    `;
    const stores = await queryBigQuery(storeQuery, params);
    const storeList = stores.map(s => ({storeId: s.storeId, storeName: s.storeName}));

    return {vendors: vendorList, stores: storeList};
  }
}
