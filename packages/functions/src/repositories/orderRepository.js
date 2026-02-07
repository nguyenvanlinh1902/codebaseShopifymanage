import {getFirestore} from 'firebase-admin/firestore';

/**
 * Order Repository
 * Backup storage for orders in Firestore (in case Google Sheets fails)
 */
export class OrderRepository {
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
      this._collection = this.db.collection('order_backups');
    }
    return this._collection;
  }

  /**
   * Save order to Firestore (backup storage)
   */
  async saveOrder(orderData) {
    try {
      // Use Shopify order ID as document ID for easy lookup
      const docId = `${orderData.storeId}_${orderData.orderId}`;

      await this.collection.doc(docId).set({
        ...orderData,
        savedAt: new Date().toISOString(),
        syncedToSheet: false,
        sheetSyncAttempts: 0
      });

      return {success: true, docId};
    } catch (error) {
      console.error('Error saving order to Firestore:', error);
      throw error;
    }
  }

  /**
   * Mark order as synced to Google Sheets
   */
  async markSyncedToSheet(storeId, orderId) {
    const docId = `${storeId}_${orderId}`;
    await this.collection.doc(docId).update({
      syncedToSheet: true,
      lastSheetSync: new Date().toISOString()
    });
  }

  /**
   * Increment sync attempt counter
   */
  async incrementSyncAttempt(storeId, orderId, error) {
    const docId = `${storeId}_${orderId}`;
    const doc = await this.collection.doc(docId).get();
    const attempts = doc.exists ? (doc.data().sheetSyncAttempts || 0) + 1 : 1;

    await this.collection.doc(docId).update({
      sheetSyncAttempts: attempts,
      lastSyncError: error,
      lastSyncAttempt: new Date().toISOString()
    });
  }

  /**
   * Get order by ID
   */
  async getOrder(storeId, orderId) {
    const docId = `${storeId}_${orderId}`;
    const doc = await this.collection.doc(docId).get();

    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Get all orders for a store
   */
  async getOrdersByStore(storeId, limit = 100) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('orderDate', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get orders that failed to sync to Sheets
   */
  async getFailedSyncOrders(storeId, maxAttempts = 3) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('syncedToSheet', '==', false)
      .where('sheetSyncAttempts', '<', maxAttempts)
      .limit(50)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get orders count by store
   */
  async getOrdersCount(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(storeId) {
    const [totalSnapshot, syncedSnapshot, failedSnapshot] = await Promise.all([
      this.collection.where('storeId', '==', storeId).count().get(),
      this.collection
        .where('storeId', '==', storeId)
        .where('syncedToSheet', '==', true)
        .count()
        .get(),
      this.collection
        .where('storeId', '==', storeId)
        .where('syncedToSheet', '==', false)
        .count()
        .get()
    ]);

    return {
      total: totalSnapshot.data().count,
      syncedToSheet: syncedSnapshot.data().count,
      failedToSync: failedSnapshot.data().count
    };
  }

  /**
   * Delete old orders (cleanup)
   */
  async deleteOldOrders(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await this.collection
      .where('orderDate', '<', cutoffDate.toISOString())
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
   * Re-sync failed orders to Google Sheets
   * Returns list of orders that need to be re-synced
   */
  async getOrdersForResync(storeId) {
    return await this.getFailedSyncOrders(storeId, 5);
  }
}
