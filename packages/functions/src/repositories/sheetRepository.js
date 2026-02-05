import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'google_sheets';

/**
 * Sheet Repository
 * Manages Google Sheets configurations in Firestore
 */
export class SheetRepository {
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

  /**
   * Create a new sheet connection
   */
  async create(sheetData) {
    const docRef = await this.collection.add({
      ...sheetData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      id: docRef.id,
      ...sheetData
    };
  }

  /**
   * Get sheet by ID
   */
  async getById(sheetId) {
    const doc = await this.collection.doc(sheetId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  /**
   * Get all sheets for a user
   */
  async getByUserId(userId) {
    const snapshot = await this.collection.where('userId', '==', userId).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get sheet by spreadsheet ID
   */
  async getBySpreadsheetId(spreadsheetId) {
    const snapshot = await this.collection.where('spreadsheetId', '==', spreadsheetId).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  }

  /**
   * Update sheet
   */
  async update(sheetId, updateData) {
    await this.collection.doc(sheetId).update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return this.getById(sheetId);
  }

  /**
   * Delete sheet
   */
  async delete(sheetId) {
    await this.collection.doc(sheetId).delete();
  }

  /**
   * Get all sheets
   */
  async getAll() {
    const snapshot = await this.collection.get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}
