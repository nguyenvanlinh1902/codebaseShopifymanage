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
   * SECURITY: Create a new sheet connection with store isolation
   * @param {object} sheetData - Must include storeId for data isolation
   */
  async create(sheetData) {
    if (!sheetData.storeId) {
      throw new Error('storeId is required for sheet creation');
    }

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
   * SECURITY: Get all sheets for a store + user
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   */
  async getByStoreAndUser(storeId, userId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('userId', '==', userId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Get all sheets for a user
   * @deprecated Use getByStoreAndUser for proper data isolation
   */
  async getByUserId(userId) {
    console.warn('[SheetRepository] getByUserId is deprecated - use getByStoreAndUser');
    const snapshot = await this.collection.where('userId', '==', userId).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * SECURITY: Get sheets for a store + user with server-side pagination
   * @param {string} storeId - Store ID (required for data isolation)
   * @param {string} userId - User ID
   * @param {object} options - Pagination options
   */
  async getByStoreAndUserPaginated(storeId, userId, {page = 1, limit = 5} = {}) {
    const baseQuery = this.collection.where('storeId', '==', storeId).where('userId', '==', userId);

    // Get total count
    const countSnapshot = await baseQuery.count().get();
    const total = countSnapshot.data().count;

    // Get paginated results
    const offset = (page - 1) * limit;
    const snapshot = await baseQuery
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const sheets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {sheets, total, page, limit};
  }

  /**
   * Get sheets for a user with server-side pagination
   * @deprecated Use getByStoreAndUserPaginated for proper data isolation
   */
  async getByUserIdPaginated(userId, {page = 1, limit = 5} = {}) {
    console.warn(
      '[SheetRepository] getByUserIdPaginated is deprecated - use getByStoreAndUserPaginated'
    );
    const baseQuery = this.collection.where('userId', '==', userId);

    // Get total count
    const countSnapshot = await baseQuery.count().get();
    const total = countSnapshot.data().count;

    // Get paginated results
    const offset = (page - 1) * limit;
    const snapshot = await baseQuery
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const sheets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {sheets, total, page, limit};
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
   * SECURITY: Check if a sheet already exists for a specific store and spreadsheetId
   * Used to prevent a single store from adding the same sheet twice
   * @param {string} storeId - Store ID
   * @param {string} spreadsheetId - Google Spreadsheet ID
   * @returns {object|null} - Sheet object if exists, null otherwise
   */
  async getByStoreAndSpreadsheet(storeId, spreadsheetId) {
    const snapshot = await this.collection
      .where('storeId', '==', storeId)
      .where('spreadsheetId', '==', spreadsheetId)
      .get();

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

  /**
   * Get all sheets with pagination (no userId/storeId filter, for standalone admin)
   */
  async getAllPaginated({page = 1, limit = 5} = {}) {
    const countSnapshot = await this.collection.count().get();
    const total = countSnapshot.data().count;

    const offset = (page - 1) * limit;
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const sheets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {sheets, total, page, limit};
  }
}
