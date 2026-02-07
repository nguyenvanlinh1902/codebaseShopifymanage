import {getFirestore} from 'firebase-admin/firestore';

/**
 * Order Sync Queue Repository
 * Manages order sync queue for cron job processing
 */
export class OrderSyncQueueRepository {
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
      this._collection = this.db.collection('order_sync_queue');
    }
    return this._collection;
  }

  /**
   * Add order to sync queue
   */
  async enqueue(orderData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...orderData,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get pending orders for processing (batch)
   */
  async getPendingBatch(limit = 100) {
    const snapshot = await this.collection
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
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
   * Get queue statistics (global)
   */
  async getQueueStats() {
    const [
      pendingSnapshot,
      processingSnapshot,
      completedSnapshot,
      failedSnapshot
    ] = await Promise.all([
      this.collection
        .where('status', '==', 'pending')
        .count()
        .get(),
      this.collection
        .where('status', '==', 'processing')
        .count()
        .get(),
      this.collection
        .where('status', '==', 'completed')
        .count()
        .get(),
      this.collection
        .where('status', '==', 'failed')
        .count()
        .get()
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
   * Get queue statistics for a specific sync job
   */
  async getQueueStatsByJobId(syncJobId) {
    const [
      pendingSnapshot,
      processingSnapshot,
      completedSnapshot,
      failedSnapshot
    ] = await Promise.all([
      this.collection
        .where('syncJobId', '==', syncJobId)
        .where('status', '==', 'pending')
        .count()
        .get(),
      this.collection
        .where('syncJobId', '==', syncJobId)
        .where('status', '==', 'processing')
        .count()
        .get(),
      this.collection
        .where('syncJobId', '==', syncJobId)
        .where('status', '==', 'completed')
        .count()
        .get(),
      this.collection
        .where('syncJobId', '==', syncJobId)
        .where('status', '==', 'failed')
        .count()
        .get()
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
   * Reset stuck processing items
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
}
