import {getFirestore, FieldValue} from 'firebase-admin/firestore';

/**
 * Tracking History Repository
 * Manages tracking import jobs and their results
 */
export class TrackingHistoryRepository {
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
      this._collection = this.db.collection('tracking_imports');
    }
    return this._collection;
  }

  /**
   * Create a new tracking import job
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
   * Add a tracking detail to an import job
   */
  async addTrackingDetail(importId, detail) {
    await this.collection.doc(importId).update({
      trackingDetails: FieldValue.arrayUnion(detail),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get imports by multiple store IDs
   */
  async getByStoreIds(storeIds, limit = 200) {
    if (!storeIds || storeIds.length === 0) return [];
    // Firestore 'in' supports max 30 values
    const chunks = [];
    for (let i = 0; i < storeIds.length; i += 30) {
      chunks.push(storeIds.slice(i, i + 30));
    }
    const results = [];
    for (const chunk of chunks) {
      const snapshot = await this.collection
        .where('storeId', 'in', chunk)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      results.push(...snapshot.docs.map(doc => doc.data()));
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.slice(0, limit);
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
}
