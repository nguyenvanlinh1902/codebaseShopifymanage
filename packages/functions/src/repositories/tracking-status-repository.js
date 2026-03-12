import {getFirestore} from 'firebase-admin/firestore';

/**
 * Statuses that should be rechecked (not final).
 * Final statuses (delivered, expired) are excluded from recheck.
 */
export const RECHECKABLE_STATUSES = [
  'pending',     // Not yet picked up or scanned
  'in_transit',  // Still moving
  'not_found',   // Carrier hasn't found it yet, may update later
  'pick_up',     // Picked up but not yet in transit
  'undelivered', // Failed delivery attempt, may retry
  'alert'        // Abnormal status, needs monitoring
];

export const FINAL_STATUSES = ['delivered', 'expired'];

/**
 * Tracking Status Repository
 * Manages 17TRACK tracking status records in Firestore
 */
export class TrackingStatusRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection('tracking_statuses');
    return this._collection;
  }

  /** Create a new tracking entry */
  async create(data) {
    const docRef = this.collection.doc();
    const now = new Date().toISOString();
    const record = {
      id: docRef.id,
      trackingNumber: data.trackingNumber,
      orderNumber: data.orderNumber || '',
      storeId: data.storeId || '',
      carrier: data.carrier || '',
      carrierCode: data.carrierCode || 0,
      status: data.status || 'pending',
      statusCode: data.statusCode || 0,
      lastEvent: data.lastEvent || '',
      lastEventDate: data.lastEventDate || '',
      isRegistered: data.isRegistered ?? false,
      isDelivered: data.isDelivered ?? false,
      lastCheckedAt: data.lastCheckedAt || now,
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(record);
    return record;
  }

  /** Get tracking by tracking number (unique) */
  async getByTrackingNumber(trackingNumber) {
    const snapshot = await this.collection
      .where('trackingNumber', '==', trackingNumber)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  }

  /**
   * Get trackings that need rechecking (non-final statuses).
   * Final statuses: delivered, expired — these are not rechecked.
   * Recheckable: pending, in_transit, not_found, pick_up, undelivered, alert
   */
  async getActiveTrackings(limit = 2000) {
    // Firestore 'in' supports up to 30 values, we have 6 recheckable statuses
    const snapshot = await this.collection
      .where('status', 'in', RECHECKABLE_STATUSES)
      .orderBy('lastCheckedAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Get all trackings for a store */
  async getByStore(storeId, limit = 5000) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Get multiple trackings by tracking numbers (batch, max 30 per query) */
  async getByTrackingNumbers(trackingNumbers) {
    if (!trackingNumbers.length) return [];
    const snapshot = await this.collection
      .where('trackingNumber', 'in', trackingNumbers)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Get unregistered trackings */
  async getUnregistered(limit = 2000) {
    const snapshot = await this.collection
      .where('isRegistered', '==', false)
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /**
   * Bulk upsert statuses: find by trackingNumber, update if exists, create if not.
   * Uses Firestore batch (max 500 per commit).
   */
  async bulkUpsert(statuses) {
    if (!statuses || statuses.length === 0) return 0;

    // Fetch existing records by trackingNumber
    const numbers = statuses.map(s => s.trackingNumber);
    const existingMap = {};

    // Firestore 'in' query allows max 30 items at once
    const chunkSize = 30;
    for (let i = 0; i < numbers.length; i += chunkSize) {
      const chunk = numbers.slice(i, i + chunkSize);
      const snap = await this.collection
        .where('trackingNumber', 'in', chunk)
        .get();
      snap.docs.forEach(d => {
        existingMap[d.data().trackingNumber] = d;
      });
    }

    // Process in batches of 500
    let upserted = 0;
    const batchSize = 500;
    for (let i = 0; i < statuses.length; i += batchSize) {
      const chunk = statuses.slice(i, i + batchSize);
      const batch = this.db.batch();
      const now = new Date().toISOString();

      for (const status of chunk) {
        const existing = existingMap[status.trackingNumber];
        if (existing) {
          batch.update(existing.ref, {
            ...status,
            updatedAt: now
          });
        } else {
          const docRef = this.collection.doc();
          batch.set(docRef, {
            id: docRef.id,
            ...status,
            createdAt: now,
            updatedAt: now
          });
        }
        upserted++;
      }

      await batch.commit();
    }

    return upserted;
  }

  /** Aggregate stats by status groups */
  async getStats() {
    const snapshot = await this.collection.get();
    const docs = snapshot.docs.map(d => d.data());
    const stats = {
      total: docs.length,
      pending: 0,
      in_transit: 0,
      delivered: 0,
      expired: 0,
      alert: 0,
      not_found: 0,
      registered: docs.filter(d => d.isRegistered).length,
      unregistered: docs.filter(d => !d.isRegistered).length
    };
    docs.forEach(d => {
      if (d.status && stats[d.status] !== undefined) stats[d.status]++;
    });
    return stats;
  }

  /** List all with limit and ordering */
  async getAll(limit = 100) {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }
}
