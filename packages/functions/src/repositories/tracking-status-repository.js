import {getFirestore} from 'firebase-admin/firestore';

/**
 * Statuses that should be rechecked (not final).
 * Final statuses (delivered, expired) are excluded from recheck.
 */
export const RECHECKABLE_STATUSES = [
  'pending',        // Not yet picked up or scanned
  'info_received',  // Carrier received tracking info, not yet picked up
  'in_transit',     // Still moving
  'not_found',      // Carrier hasn't found it yet, may update later
  'pick_up',        // Picked up but not yet in transit
  'undelivered',    // Failed delivery attempt, may retry
  'alert'           // Abnormal status, needs monitoring
];

export const FINAL_STATUSES = ['delivered', 'expired'];

export const STALE_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

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
      isStale: false,
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
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Get trackings for a store filtered by status (compound Firestore query) */
  async getByStoreAndStatus(storeId, status, limit = 5000) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('status', '==', status)
      .orderBy('lastCheckedAt', 'desc')
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

  /** Delete trackings by tracking numbers (batch, max 30 per query) */
  async deleteByTrackingNumbers(trackingNumbers) {
    if (!trackingNumbers.length) return 0;
    let deleted = 0;
    for (let i = 0; i < trackingNumbers.length; i += 30) {
      const chunk = trackingNumbers.slice(i, i + 30);
      const snapshot = await this.collection
        .where('trackingNumber', 'in', chunk)
        .get();
      if (snapshot.empty) continue;
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += snapshot.size;
    }
    return deleted;
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
          const existingData = existing.data();
          const effectiveStatus = status.status || existingData.status;
          const lastEventRef = status.lastEventDate || existingData.lastEventDate
            || status.firstEventDate || existingData.firstEventDate || existingData.createdAt || now;
          const isStale = RECHECKABLE_STATUSES.includes(effectiveStatus)
            && (Date.now() - new Date(lastEventRef).getTime()) > STALE_THRESHOLD_MS;
          batch.update(existing.ref, {
            ...status,
            isStale,
            updatedAt: now
          });
        } else {
          const docRef = this.collection.doc();
          batch.set(docRef, {
            id: docRef.id,
            ...status,
            isStale: false,
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

  /**
   * Delete invalid tracking records:
   * - Scientific notation numbers (e.g. 4.2078e+29)
   * - Expired records with "Rejected by 17TRACK" in lastEvent
   */
  async deleteInvalid() {
    const snapshot = await this.collection.get();
    const invalidDocs = snapshot.docs.filter(d => {
      const data = d.data();
      const num = data.trackingNumber || '';
      // Scientific notation (JS converted long numbers)
      if (/^\d+\.\d+e\+\d+$/i.test(num)) return true;
      // Expired rejects from 17TRACK
      if (data.status === 'expired' && data.lastEvent?.startsWith('Rejected by 17TRACK')) return true;
      return false;
    });

    if (!invalidDocs.length) return 0;

    // Delete in batches of 500
    for (let i = 0; i < invalidDocs.length; i += 500) {
      const batch = this.db.batch();
      invalidDocs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    return invalidDocs.length;
  }

  /** Aggregate stats by status groups (optionally filtered by storeIds) */
  async getStats(storeIds = null) {
    let docs;
    if (storeIds?.length) {
      // Query per store (Firestore 'in' max 30)
      const allDocs = [];
      for (let i = 0; i < storeIds.length; i += 30) {
        const chunk = storeIds.slice(i, i + 30);
        const snap = await this.collection.where('storeId', 'in', chunk).get();
        allDocs.push(...snap.docs.map(d => d.data()));
      }
      docs = allDocs;
    } else {
      const snapshot = await this.collection.get();
      docs = snapshot.docs.map(d => d.data());
    }
    const stats = {
      total: docs.length,
      pending: 0,
      info_received: 0,
      in_transit: 0,
      delivered: 0,
      expired: 0,
      alert: 0,
      not_found: 0,
      pick_up: 0,
      undelivered: 0,
      stale: 0,
      registered: docs.filter(d => d.isRegistered).length,
      unregistered: docs.filter(d => !d.isRegistered).length
    };
    docs.forEach(d => {
      if (d.status && stats[d.status] !== undefined) stats[d.status]++;
      if (d.isStale === true) stats.stale++;
    });
    return stats;
  }

  /**
   * Get active trackings grouped by apiKeyId.
   * Returns Map<apiKeyId|'__none__', tracking[]>
   */
  async getActiveGroupedByKey(limit = 2000) {
    const snapshot = await this.collection
      .where('status', 'in', RECHECKABLE_STATUSES)
      .orderBy('lastCheckedAt', 'asc')
      .limit(limit)
      .get();
    const grouped = new Map();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key = data.apiKeyId || '__none__';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(data);
    }
    return grouped;
  }

  /**
   * Get trackings by status, grouped by apiKeyId.
   * Returns Map<apiKeyId|'__none__', tracking[]>
   */
  async getByStatusGroupedByKey(status, limit = 2000) {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('lastCheckedAt', 'asc')
      .limit(limit)
      .get();
    const grouped = new Map();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key = data.apiKeyId || '__none__';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(data);
    }
    return grouped;
  }

  /** Get trackings filtered by a single status */
  async getByStatus(status, limit = 2000) {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('lastCheckedAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Delete a tracking by its doc id */
  async deleteById(id) {
    const snap = await this.collection.where('id', '==', id).limit(1).get();
    if (snap.empty) throw new Error(`Tracking ${id} not found`);
    await snap.docs[0].ref.delete();
  }

  /** Delete multiple trackings by doc ids (batch) */
  async deleteByIds(ids) {
    if (!ids.length) return 0;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snap = await this.collection.where('id', 'in', chunk).get();
      if (snap.empty) continue;
      const batch = this.db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += snap.size;
    }
    return deleted;
  }

  /** Hide or unhide a tracking by its doc id */
  async setHidden(id, isHidden) {
    const snap = await this.collection.where('id', '==', id).limit(1).get();
    if (snap.empty) throw new Error(`Tracking ${id} not found`);
    await snap.docs[0].ref.update({isHidden, updatedAt: new Date().toISOString()});
  }

  /** Get stale trackings (no event update for 7+ days, not final) */
  async getStaleTrackings(limit = 500) {
    const snapshot = await this.collection
      .where('isStale', '==', true)
      .orderBy('lastEventDate', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
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
