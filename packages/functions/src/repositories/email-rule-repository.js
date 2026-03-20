import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_email_rules';

/**
 * Email Rule Repository — CRUD for filter rules per store
 */
export class EmailRuleRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection(COLLECTION_NAME);
    return this._collection;
  }

  async getAllByStoreId(storeId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .orderBy('priority')
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async getById(storeId, ruleId) {
    const doc = await this.collection.doc(ruleId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.storeId !== storeId) return null;
    return {id: doc.id, ...data};
  }

  async create(storeId, ruleData) {
    const now = new Date().toISOString();
    const docRef = await this.collection.add({
      storeId,
      ...ruleData,
      enabled: ruleData.enabled !== false,
      createdAt: now,
      updatedAt: now
    });
    return {id: docRef.id, storeId, ...ruleData};
  }

  async update(storeId, ruleId, ruleData) {
    const existing = await this.getById(storeId, ruleId);
    if (!existing) return null;
    await this.collection.doc(ruleId).update({
      ...ruleData,
      updatedAt: new Date().toISOString()
    });
    return this.getById(storeId, ruleId);
  }

  async delete(storeId, ruleId) {
    const existing = await this.getById(storeId, ruleId);
    if (!existing) return false;
    await this.collection.doc(ruleId).delete();
    return true;
  }

  async toggleEnabled(storeId, ruleId) {
    const existing = await this.getById(storeId, ruleId);
    if (!existing) return null;
    const newEnabled = !existing.enabled;
    await this.collection.doc(ruleId).update({
      enabled: newEnabled,
      updatedAt: new Date().toISOString()
    });
    return {...existing, enabled: newEnabled};
  }
}
