import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION = 'store_groups';

/**
 * Store Group Repository
 * Manages store group documents in Firestore
 */
export class StoreGroupRepository {
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

  async create(data) {
    const now = new Date().toISOString();
    const docRef = await this.collection.add({
      ...data,
      createdAt: now,
      updatedAt: now
    });
    return {id: docRef.id, ...data, createdAt: now, updatedAt: now};
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async getAll() {
    const snap = await this.collection.orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({id: d.id, ...d.data()}));
  }

  async update(id, data) {
    await this.collection.doc(id).update({...data, updatedAt: new Date().toISOString()});
    return this.getById(id);
  }

  async delete(id) {
    await this.collection.doc(id).delete();
  }
}
