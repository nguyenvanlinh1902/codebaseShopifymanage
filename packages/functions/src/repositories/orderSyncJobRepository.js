import {getFirestore} from 'firebase-admin/firestore';

/**
 * Order Sync Job Repository
 * Tracks progress of each manual sync operation
 */
export class OrderSyncJobRepository {
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
      this._collection = this.db.collection('order_sync_jobs');
    }
    return this._collection;
  }

  /**
   * Create a new sync job
   */
  async create(jobData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...jobData,
      processedOrders: 0,
      successCount: 0,
      failedCount: 0,
      nextPageParams: jobData.nextPageParams || null,
      lastOrderId: jobData.lastOrderId || null,
      hasNextPage: jobData.hasNextPage || false,
      currentPage: jobData.currentPage || 1,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get job by ID
   */
  async getById(jobId) {
    const doc = await this.collection.doc(jobId).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Update job
   */
  async update(jobId, updates) {
    await this.collection.doc(jobId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get active (processing) job for a store
   */
  async getActiveJob(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('status', '==', 'processing')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }

  /**
   * Get sync jobs for a store (history)
   */
  async getJobsByStore(storeId, limit = 10) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }
}
