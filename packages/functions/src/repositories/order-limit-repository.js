import {getFirestore, FieldValue} from 'firebase-admin/firestore';

const COLLECTION = 'order_limit_rules';

/**
 * Order Limit Repository
 * Manages daily order limit rules and counters in Firestore
 */
export class OrderLimitRepository {
  constructor() {
    this._db = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    return this.db.collection(COLLECTION);
  }

  /** Create a new order limit rule */
  async createRule({shopDomain, dailyLimit, totalLimit, timezone, normalTemplateId, highPriceTemplateId}) {
    const docRef = this.collection.doc();
    const now = new Date().toISOString();
    const currentDate = getTodayInTimezone(timezone);
    const record = {
      id: docRef.id,
      shopDomain,
      dailyLimit,
      totalLimit: totalLimit || 0,
      timezone,
      normalTemplateId,
      highPriceTemplateId,
      enabled: true,
      currentCount: 0,
      totalCount: 0,
      currentDate,
      isLimited: false,
      lastAppliedTemplate: 'normal',
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(record);
    return record;
  }

  /** Get single rule by ID */
  async getRule(id) {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  /** Get enabled rule by shopDomain */
  async getRuleByShopDomain(shopDomain) {
    const snapshot = await this.collection
      .where('shopDomain', '==', shopDomain)
      .where('enabled', '==', true)
      .limit(1)
      .get();
    return snapshot.empty ? null : snapshot.docs[0].data();
  }

  /** List all rules ordered by createdAt desc */
  async listRules() {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => d.data());
  }

  /** Partial update a rule */
  async updateRule(id, updates) {
    updates.updatedAt = new Date().toISOString();
    await this.collection.doc(id).update(updates);
  }

  /** Delete a rule */
  async deleteRule(id) {
    await this.collection.doc(id).delete();
  }

  /** Atomically increment currentCount and totalCount, return updated doc */
  async incrementCount(id) {
    const docRef = this.collection.doc(id);
    await docRef.update({
      currentCount: FieldValue.increment(1),
      totalCount: FieldValue.increment(1)
    });
    const doc = await docRef.get();
    return doc.data();
  }

  /** Reset counter for new day */
  async resetRule(id, newDate) {
    await this.collection.doc(id).update({
      currentCount: 0,
      isLimited: false,
      currentDate: newDate,
      updatedAt: new Date().toISOString()
    });
  }

  /** Get all enabled rules (for cron) */
  async getEnabledRules() {
    const snapshot = await this.collection.where('enabled', '==', true).get();
    return snapshot.docs.map(d => d.data());
  }
}

/** Get today's date string in a timezone (YYYY-MM-DD) */
function getTodayInTimezone(tz) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(new Date());
}
