import {getFirestore} from 'firebase-admin/firestore';

export class ThemeRepository {
  get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }

  get collection() {
    if (!this._collection) {
      this._collection = this.db.collection('imported_themes');
    }
    return this._collection;
  }

  async create(data) {
    const docRef = this.collection.doc();
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now
    };
    await docRef.set(record);
    return record;
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async getByUserId(userId) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async update(id, data) {
    const now = new Date().toISOString();
    await this.collection.doc(id).update({...data, updatedAt: now});
    return {id, ...data, updatedAt: now};
  }

  async delete(id) {
    await this.collection.doc(id).delete();
    return true;
  }
}
