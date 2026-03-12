import {getFirestore, FieldValue} from 'firebase-admin/firestore';

/**
 * Tracking API Key Repository
 * Manages 17TRACK API keys with quota tracking and rotation support
 */
export class TrackingApiKeyRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection('tracking_api_keys');
    return this._collection;
  }

  /** Add a new API key with sensible defaults */
  async create(data) {
    const docRef = this.collection.doc();
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const record = {
      id: docRef.id,
      name: data.name || 'Unnamed Key',
      apiKey: data.apiKey,
      status: 'active',
      quotaTotal: data.quotaTotal ?? 100,
      quotaUsed: 0,
      quotaResetDate: nextMonth.toISOString(),
      lastUsedAt: null,
      lastError: null,
      errorCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    await docRef.set(record);
    return record;
  }

  /** Fetch a single key by ID */
  async getById(id) {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  /** List all keys */
  async getAll() {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => d.data());
  }

  /**
   * Find the best available key: active, under quota limit, lowest usage ratio.
   * Sorted in-memory to avoid composite index requirements.
   */
  async getAvailableKey() {
    const snapshot = await this.collection.where('status', '==', 'active').get();
    const keys = snapshot.docs.map(d => d.data());
    const available = keys.filter(k => k.quotaUsed < k.quotaTotal);
    if (!available.length) return null;
    available.sort((a, b) => (a.quotaUsed / a.quotaTotal) - (b.quotaUsed / b.quotaTotal));
    return available[0];
  }

  /** Get any active key (ignores quota). For free operations like getTrackInfo. */
  async getAnyActiveKey() {
    const snapshot = await this.collection.where('status', '==', 'active').get();
    const keys = snapshot.docs.map(d => d.data());
    if (!keys.length) return null;
    keys.sort((a, b) => (a.quotaUsed / a.quotaTotal) - (b.quotaUsed / b.quotaTotal));
    return keys[0];
  }

  /** Increment quota usage by count (only for actually accepted registrations) */
  async incrementQuota(id, count = 1) {
    await this.collection.doc(id).update({
      quotaUsed: FieldValue.increment(count),
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /** Record an error; ban key after 5 consecutive errors */
  async markError(id, errorMsg) {
    const key = await this.getById(id);
    if (!key) return;
    const errorCount = (key.errorCount || 0) + 1;
    const updates = {
      errorCount,
      lastError: errorMsg,
      updatedAt: new Date().toISOString()
    };
    if (errorCount >= 5) updates.status = 'banned';
    await this.collection.doc(id).update(updates);
  }

  /** Reset error state on successful call */
  async markSuccess(id) {
    await this.collection.doc(id).update({
      errorCount: 0,
      lastError: null,
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /** Generic field update */
  async update(id, data) {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  /** Delete a key by ID */
  async delete(id) {
    await this.collection.doc(id).delete();
  }

  /**
   * Reset monthly quotas for keys whose reset date has passed.
   * Sets quotaUsed=0 and advances quotaResetDate by one month.
   */
  async resetMonthlyQuotas() {
    const today = new Date().toISOString();
    const snapshot = await this.collection
      .where('quotaResetDate', '<=', today)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      const key = doc.data();
      const current = new Date(key.quotaResetDate);
      const nextReset = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      batch.update(doc.ref, {
        quotaUsed: 0,
        quotaResetDate: nextReset.toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
    return snapshot.size;
  }

  /** Aggregate stats across all keys */
  async getStats() {
    const keys = await this.getAll();
    return {
      total: keys.length,
      active: keys.filter(k => k.status === 'active').length,
      banned: keys.filter(k => k.status === 'banned').length,
      quotaExceeded: keys.filter(k => k.status === 'quota_exceeded').length,
      totalQuotaUsed: keys.reduce((s, k) => s + (k.quotaUsed || 0), 0),
      totalQuotaTotal: keys.reduce((s, k) => s + (k.quotaTotal || 0), 0)
    };
  }
}
