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
   * Register webhook for store
   */
  async registerWebhook(webhookData) {
    const docRef = this.webhookCollection.doc();
    const data = {
      id: docRef.id,
      ...webhookData,
      createdAt: new Date().toISOString()
    };
    await docRef.set(data);
    return data;
  }

  /**
   * Get webhook by Shopify webhook ID
   */
  async getWebhookByShopifyId(shopifyWebhookId) {
    const snapshot = await this.webhookCollection
      .where('shopifyWebhookId', '==', shopifyWebhookId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
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
   * Check if order was already synced
   */
  async isOrderSynced(storeId, shopifyOrderId) {
    const snapshot = await this.db
      .collection('order_synced')
      .where('storeId', '==', storeId)
      .where('shopifyOrderId', '==', shopifyOrderId)
      .limit(1)
      .get();

    return !snapshot.empty;
  }
}
