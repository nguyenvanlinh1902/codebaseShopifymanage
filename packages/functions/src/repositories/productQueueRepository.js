import {getFirestore} from 'firebase-admin/firestore';

/**
 * Product Queue Repository
 * Manages product import queue for cron job processing
 */
export class ProductQueueRepository {
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
      this._collection = this.db.collection('product_import_queue');
    }
    return this._collection;
  }

  /**
   * Add product to queue
   */
  async enqueue(productData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...productData,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get pending products for processing (batch)
   */
  async getPendingBatch(limit = 50) {
    const snapshot = await this.collection
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
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
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Update queue item status
   */
  async updateStatus(queueId, status, error = null) {
    const updates = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (status === 'processing') {
      updates.processingAt = new Date().toISOString();
    }

    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }

    if (status === 'failed' && error) {
      updates.error = error;
      updates.failedAt = new Date().toISOString();
    }

    await this.collection.doc(queueId).update(updates);
  }

  /**
   * Increment retry attempts
   */
  async incrementAttempts(queueId) {
    const doc = await this.collection.doc(queueId).get();
    const attempts = doc.exists ? (doc.data().attempts || 0) + 1 : 1;

    await this.collection.doc(queueId).update({
      attempts,
      lastAttemptAt: new Date().toISOString()
    });

    return attempts;
  }

  /**
   * Mark as failed after max attempts
   */
  async markFailed(queueId, error) {
    await this.collection.doc(queueId).update({
      status: 'failed',
      error,
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [pendingSnapshot, processingSnapshot, completedSnapshot, failedSnapshot] = await Promise.all([
      this.collection.where('status', '==', 'pending').count().get(),
      this.collection.where('status', '==', 'processing').count().get(),
      this.collection.where('status', '==', 'completed').count().get(),
      this.collection.where('status', '==', 'failed').count().get()
    ]);

    return {
      pending: pendingSnapshot.data().count,
      processing: processingSnapshot.data().count,
      completed: completedSnapshot.data().count,
      failed: failedSnapshot.data().count,
      total:
        pendingSnapshot.data().count +
        processingSnapshot.data().count +
        completedSnapshot.data().count +
        failedSnapshot.data().count
    };
  }

  /**
   * Get queue statistics by store
   * @param {string} storeId - Store ID to filter by
   */
  async getQueueStatsByStore(storeId) {
    const [pendingSnapshot, processingSnapshot, completedSnapshot, failedSnapshot] = await Promise.all([
      this.collection.where('storeId', '==', storeId).where('status', '==', 'pending').count().get(),
      this.collection.where('storeId', '==', storeId).where('status', '==', 'processing').count().get(),
      this.collection.where('storeId', '==', storeId).where('status', '==', 'completed').count().get(),
      this.collection.where('storeId', '==', storeId).where('status', '==', 'failed').count().get()
    ]);

    return {
      pending: pendingSnapshot.data().count,
      processing: processingSnapshot.data().count,
      completed: completedSnapshot.data().count,
      failed: failedSnapshot.data().count,
      total:
        pendingSnapshot.data().count +
        processingSnapshot.data().count +
        completedSnapshot.data().count +
        failedSnapshot.data().count
    };
  }

  /**
   * Clean up old completed queue items
   */
  async cleanup(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await this.collection
      .where('status', '==', 'completed')
      .where('completedAt', '<', cutoffDate.toISOString())
      .limit(500)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
  }

  /**
   * Reset stuck processing items (items that have been processing for too long)
   */
  async resetStuckItems(timeoutMinutes = 30) {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - timeoutMinutes);

    const snapshot = await this.collection
      .where('status', '==', 'processing')
      .where('processingAt', '<', cutoffDate.toISOString())
      .limit(100)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'pending',
        updatedAt: new Date().toISOString()
      });
    });

    await batch.commit();
    return snapshot.size;
  }
}
