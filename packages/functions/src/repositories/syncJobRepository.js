import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'sync_jobs';

/**
 * Sync Job Repository
 * Tracks sync operations between Shopify and Google Sheets
 */
export class SyncJobRepository {
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
   * Create a new sync job
   */
  async create(jobData) {
    const docRef = await this.collection.add({
      ...jobData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      id: docRef.id,
      ...jobData
    };
  }

  /**
   * Get job by ID
   */
  async getById(jobId) {
    const doc = await this.collection.doc(jobId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  /**
   * Get jobs by user ID
   */
  async getByUserId(userId, limit = 50) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get all jobs (no userId filter, for standalone admin)
   */
  async getAll(limit = 50) {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Get jobs by store ID
   */
  async getByStoreId(storeId, limit = 50) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Update job status
   */
  async updateStatus(jobId, status, result = null) {
    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (result) {
      updateData.result = result;
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date().toISOString();
    }

    await this.collection.doc(jobId).update(updateData);

    return this.getById(jobId);
  }

  /**
   * Get recent jobs
   */
  async getRecent(limit = 20) {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').limit(limit).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get pending jobs
   */
  async getPending() {
    const snapshot = await this.collection.where('status', '==', 'pending').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Delete old jobs (cleanup)
   */
  async deleteOlderThan(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const snapshot = await this.collection
      .where('createdAt', '<', cutoffDate.toISOString())
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return snapshot.size;
  }
}
