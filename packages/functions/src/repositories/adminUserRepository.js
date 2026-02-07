import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'admin_users';

export class AdminUserRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }

  get collection() {
    if (!this._collection) {
      this._collection = this.db.collection(COLLECTION_NAME);
    }
    return this._collection;
  }

  async getById(userId) {
    const doc = await this.collection.doc(userId).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async getByUsername(username) {
    const snapshot = await this.collection
      .where('username', '==', username)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async create(userData) {
    const docRef = await this.collection.add({
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return {id: docRef.id, ...userData};
  }

  async update(userId, data) {
    await this.collection.doc(userId).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }
}
