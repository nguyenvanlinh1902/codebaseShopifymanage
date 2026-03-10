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
   * Get multiple stores by an array of IDs (batch fetch)
   */
  async getByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const docRefs = ids.map(id => this.collection.doc(id));
    const docs = await this.db.getAll(...docRefs);
    return docs
      .filter(doc => doc.exists)
      .map(doc => ({id: doc.id, ...doc.data()}));
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
  async getByUserIdPaginated(userId, {page = 1, limit = 10, groupId} = {}) {
    let baseQuery = this.collection.where('userId', '==', userId);
    if (groupId) baseQuery = baseQuery.where('groupId', '==', groupId);

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

    // userId=null means admin (no user filter)
    const userClause = userId ? 'WHERE userId = @userId' : 'WHERE TRUE';
    let nicheClause = '';
    const params = {limit, offset};
    if (userId) params.userId = userId;
    if (niches.length > 0) {
      nicheClause = ' AND niche IN UNNEST(@niches)';
      params.niches = niches;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`${dataset}.shopify_stores_latest_view\`
      ${userClause}${nicheClause}
    `;
    const countRows = await queryBigQuery(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      SELECT document_id, userId, shopDomain, name, niche, email,
             currency, timezone, status, createdAt, updatedAt
      FROM \`${dataset}.shopify_stores_latest_view\`
      ${userClause}${nicheClause}
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
   * Search stores by name or shopDomain using BigQuery (CONTAINS text).
   * userId=null means admin — no user filter applied.
   */
  async searchStores(userId, {search, page = 1, limit = 10, niches = []} = {}) {
    const dataset = bigQueryConfig.datasetId;
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    // userId=null means admin (no user filter)
    const userClause = userId ? 'AND userId = @userId' : '';
    let nicheClause = '';
    const params = {search: searchTerm, limit, offset};
    if (userId) params.userId = userId;
    if (niches.length > 0) {
      nicheClause = ' AND niche IN UNNEST(@niches)';
      params.niches = niches;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE (LOWER(name) LIKE LOWER(@search) OR LOWER(shopDomain) LIKE LOWER(@search))
        ${userClause}${nicheClause}
    `;
    const countRows = await queryBigQuery(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      SELECT document_id, userId, shopDomain, name, niche, email,
             currency, timezone, status, createdAt, updatedAt
      FROM \`${dataset}.shopify_stores_latest_view\`
      WHERE (LOWER(name) LIKE LOWER(@search) OR LOWER(shopDomain) LIKE LOWER(@search))
        ${userClause}${nicheClause}
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
   * Get all stores with pagination (no userId filter)
   */
  async getAllPaginated({page = 1, limit = 10, groupId} = {}) {
    const baseQuery = groupId
      ? this.collection.where('groupId', '==', groupId)
      : this.collection;

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
   * Get all stores belonging to a group
   */
  async getByGroupId(groupId) {
    const snap = await this.collection.where('groupId', '==', groupId).get();
    return snap.docs.map(d => ({id: d.id, ...d.data()}));
  }

  /**
   * Clear groupId from all stores in a group (called when group is deleted)
   */
  async clearGroupId(groupId) {
    const snap = await this.collection.where('groupId', '==', groupId).get();
    if (snap.empty) return;
    const batch = this.db.batch();
    const now = new Date().toISOString();
    snap.docs.forEach(d => batch.update(d.ref, {groupId: null, updatedAt: now}));
    await batch.commit();
  }

  /**
   * Get all unique niche values across all stores
   */
  async getAllNiches() {
    const snapshot = await this.collection.select('niche').get();

    const niches = new Set();
    snapshot.docs.forEach(doc => {
      const niche = doc.data().niche;
      if (niche) niches.add(niche);
    });

    return [...niches].sort();
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
   * Mark store as hitting Shopify's daily variant creation limit.
   * Resets at midnight UTC — frontend uses this to disable the store in import selection.
   */
  async markVariantThrottled(storeId) {
    await this.collection.doc(storeId).update({
      variantThrottledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
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
