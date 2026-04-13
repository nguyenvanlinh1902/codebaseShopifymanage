import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'custom_field_definitions';
const DEPLOYMENT_COLLECTION = 'custom_field_deployments';

/**
 * Custom Field Repository
 * Manages custom field definitions in Firestore (app-wide, not per-store)
 */
export class CustomFieldRepository {
  constructor() {
    this._db = null;
    this._collection = null;
    this._deploymentCollection = null;
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

  get deploymentCollection() {
    if (!this._deploymentCollection) {
      this._deploymentCollection = this.db.collection(DEPLOYMENT_COLLECTION);
    }
    return this._deploymentCollection;
  }

  async create(data) {
    const docRef = await this.collection.add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return {id: docRef.id, ...data};
  }

  async getAll() {
    const snapshot = await this.collection.orderBy('sortOrder', 'asc').get();
    return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async getByKey(key) {
    const snapshot = await this.collection.where('key', '==', key).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async update(id, data) {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
    return this.getById(id);
  }

  async delete(id) {
    await this.collection.doc(id).delete();
  }

  // Deployment tracking methods
  async getDeployment(storeId) {
    const doc = await this.deploymentCollection.doc(storeId).get();
    if (!doc.exists) return null;
    return {storeId: doc.id, ...doc.data()};
  }

  async setDeployment(storeId, data) {
    await this.deploymentCollection.doc(storeId).set({
      ...data,
      updatedAt: new Date().toISOString()
    }, {merge: true});
  }

  async deleteDeployment(storeId) {
    await this.deploymentCollection.doc(storeId).delete();
  }
}

export default new CustomFieldRepository();
