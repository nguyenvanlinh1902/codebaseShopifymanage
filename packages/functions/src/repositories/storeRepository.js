import {getFirestore} from 'firebase-admin/firestore';
import {queryBigQuery} from '../services/bigQueryService.js';
import bigQueryConfig from '../config/bigQuery.js';

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
   * Get all unique niche values for a user (Firestore - no composite index needed)
   */
  async getNichesByUserId(userId) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .select('niche')
      .get();

    const niches = new Set();
    snapshot.docs.forEach(doc => {
      const niche = doc.data().niche;
      if (niche) niches.add(niche);
    });

    return [...niches].sort();
  }

  /**
   * Get stores for a user with server-side pagination (Firestore, no niche filter)
   */
  async getByUserIdPaginated(userId, {page = 1, limit = 10} = {}) {
    const baseQuery = this.collection.where('userId', '==', userId);

    const countSnapshot = await baseQuery.count().get();
    const total = countSnapshot.data().count;

    const offset = (page - 1) * limit;
    const snapshot = await baseQuery
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const stores = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {stores, total, page, limit};
  }

  /**
   * Get stores for a user with niche filter (via BigQuery)
   */
  async getByUserIdWithNiches(userId, {page = 1, limit = 10, niches = []} = {}) {
    const dataset = bigQueryConfig.datasetId;
    const offset = (page - 1) * limit;

    let nicheClause = '';
    const params = {userId, limit, offset};
    if (niches.length > 0) {
      nicheClause = ' AND niche IN UNNEST(@niches)';
      params.niches = niches;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE userId = @userId${nicheClause}
    `;
    const countRows = await queryBigQuery(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      SELECT document_id, userId, shopDomain, name, niche, email,
             currency, timezone, status, createdAt, updatedAt
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE userId = @userId${nicheClause}
      ORDER BY createdAt DESC
      LIMIT @limit OFFSET @offset
    `;
    const rows = await queryBigQuery(dataQuery, params);

    const stores = rows.map(row => ({
      id: row.document_id,
      ...row
    }));

    return {stores, total, page, limit};
  }

  /**
   * Search stores by name or shopDomain using BigQuery (CONTAINS text)
   */
  async searchStores(userId, {search, page = 1, limit = 10, niches = []} = {}) {
    const dataset = bigQueryConfig.datasetId;
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    let nicheClause = '';
    const params = {userId, search: searchTerm, limit, offset};
    if (niches.length > 0) {
      nicheClause = ' AND niche IN UNNEST(@niches)';
      params.niches = niches;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE userId = @userId
        AND (LOWER(name) LIKE LOWER(@search) OR LOWER(shopDomain) LIKE LOWER(@search))
        ${nicheClause}
    `;
    const countRows = await queryBigQuery(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      SELECT document_id, userId, shopDomain, name, niche, email,
             currency, timezone, status, createdAt, updatedAt
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE userId = @userId
        AND (LOWER(name) LIKE LOWER(@search) OR LOWER(shopDomain) LIKE LOWER(@search))
        ${nicheClause}
      ORDER BY createdAt DESC
      LIMIT @limit OFFSET @offset
    `;
    const rows = await queryBigQuery(dataQuery, params);

    const stores = rows.map(row => ({
      id: row.document_id,
      ...row
    }));

    return {stores, total, page, limit};
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
