import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'policy_templates';

/**
 * Policy Template Repository — stores editable policy HTML templates.
 * Single document per policy type (REFUND_POLICY, SHIPPING_POLICY, etc.)
 * Each doc: { type, body (HTML with {{storeName}}, {{email}}, {{lastUpdated}} placeholders), updatedAt }
 */
export class PolicyTemplateRepository {
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

  /** Get all saved templates */
  async getAll() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /** Get template by policy type (e.g. 'REFUND_POLICY') */
  async getByType(type) {
    const doc = await this.collection.doc(type).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  /** Create or update template for a policy type. Uses type as doc ID. */
  async upsert(type, body) {
    const now = new Date().toISOString();
    await this.collection.doc(type).set(
      {type, body, updatedAt: now},
      {merge: true}
    );
    return {id: type, type, body, updatedAt: now};
  }

  /** Bulk upsert multiple templates at once */
  async bulkUpsert(templates) {
    const batch = this.db.batch();
    const now = new Date().toISOString();
    for (const {type, body} of templates) {
      const ref = this.collection.doc(type);
      batch.set(ref, {type, body, updatedAt: now}, {merge: true});
    }
    await batch.commit();
    return templates.map(t => ({id: t.type, ...t, updatedAt: now}));
  }

  /** Delete a template (reverts to hardcoded default) */
  async delete(type) {
    await this.collection.doc(type).delete();
    return true;
  }
}
