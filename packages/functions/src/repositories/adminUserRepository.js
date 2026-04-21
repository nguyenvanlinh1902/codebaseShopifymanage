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

  async getAll() {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  /**
   * Bump permissionsChangedAt so any currently-active JWT issued before this
   * instant will be rejected by the auth middleware on its next request.
   * Call whenever role, assignedStores, allowedFeatures, or status change.
   */
  async touchPermissions(userId) {
    await this.collection.doc(userId).update({
      permissionsChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async deactivate(userId) {
    await this.collection.doc(userId).update({
      status: 'inactive',
      updatedAt: new Date().toISOString()
    });
  }

  async deleteById(userId) {
    await this.collection.doc(userId).delete();
  }
}
