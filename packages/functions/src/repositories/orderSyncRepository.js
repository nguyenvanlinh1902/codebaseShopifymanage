import {getFirestore} from 'firebase-admin/firestore';

/**
 * Order Sync Repository
 * Manages order sync jobs and webhook registrations
 */
export class OrderSyncRepository {
  constructor() {
    this._db = null;
    this._collection = null;
    this._webhookCollection = null;
  }

  get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }

  get collection() {
    if (!this._collection) {
      this._collection = this.db.collection('order_configs');
    }
    return this._collection;
  }

  get webhookCollection() {
    if (!this._webhookCollection) {
      this._webhookCollection = this.db.collection('order_webhooks');
    }
    return this._webhookCollection;
  }

  /**
   * Create a new sync job
   */
  async createSyncJob(syncData) {
    const docRef = this.collection.doc();
    const data = {
      id: docRef.id,
      ...syncData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get sync job by ID
   */
  async getSyncJobById(syncId) {
    const doc = await this.collection.doc(syncId).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Get all sync jobs for a store
   */
  async getSyncJobsByStore(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .limit(50)
      .get();

    return snapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /**
   * Get all sync configs (single query instead of per-store loop)
   */
  async getAllConfigs() {
    const snapshot = await this.collection.limit(500).get();
    return snapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /**
   * Get active sync configuration for a store
   */
  async getActiveSyncConfig(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }

  /**
   * Update sync job
   */
  async updateSyncJob(syncId, updates) {
    await this.collection.doc(syncId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Get webhooks for store
   */
  async getWebhooksByStore(storeId) {
    const snapshot = await this.webhookCollection.where('storeId', '==', storeId).get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    await this.webhookCollection.doc(webhookId).delete();
  }

  /**
   * Track synced order
   */
  async trackSyncedOrder(orderData) {
    const docRef = this.db.collection('order_synced').doc();
    await docRef.set({
      id: docRef.id,
      ...orderData,
      syncedAt: new Date().toISOString()
    });
  }

  /**
   * Atomically claim an order for syncing using a deterministic document ID.
   * Returns true if claimed (first to claim), false if already claimed (duplicate).
   * Uses Firestore create() which is atomic — only one concurrent caller wins.
   */
  async claimOrderSync(storeId, shopifyOrderId, orderNumber) {
    const docId = `${storeId}_${shopifyOrderId}`;
    const docRef = this.db.collection('order_synced').doc(docId);
    try {
      await docRef.create({
        id: docId,
        storeId,
        shopifyOrderId,
        orderNumber,
        syncedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      if (err.code === 6 || err.code === 'already-exists') return false;
      throw err;
    }
  }

  /**
   * Release a previously claimed order (used when sync fails, to allow retries).
   */
  async releaseOrderClaim(storeId, shopifyOrderId) {
    const docId = `${storeId}_${shopifyOrderId}`;
    await this.db.collection('order_synced').doc(docId).delete();
  }

  /**
   * Check if order was already synced
   */
  async isOrderSynced(storeId, shopifyOrderId) {
    // Check both old-style (random doc ID) and new deterministic doc
    const docId = `${storeId}_${shopifyOrderId}`;
    const det = await this.db.collection('order_synced').doc(docId).get();
    if (det.exists) return true;

    const snapshot = await this.db
      .collection('order_synced')
      .where('storeId', '==', storeId)
      .where('shopifyOrderId', '==', shopifyOrderId)
      .limit(1)
      .get();

    return !snapshot.empty;
  }
}
