import {getFirestore, FieldValue} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'key_tokens';

export class KeyTokenRepository {
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

  async getByUserId(userId) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async createOrUpdate(userId, refreshToken) {
    const existing = await this.getByUserId(userId);
    if (existing) {
      await this.collection.doc(existing.id).update({
        refreshToken,
        refreshTokensUsed: [],
        updatedAt: new Date().toISOString()
      });
      return {id: existing.id, userId, refreshToken};
    }

    const docRef = await this.collection.add({
      userId,
      refreshToken,
      refreshTokensUsed: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return {id: docRef.id, userId, refreshToken};
  }

  async findByRefreshToken(refreshToken) {
    const snapshot = await this.collection
      .where('refreshToken', '==', refreshToken)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async findByRefreshTokenUsed(refreshToken) {
    const snapshot = await this.collection
      .where('refreshTokensUsed', 'array-contains', refreshToken)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {id: doc.id, ...doc.data()};
  }

  async updateRefreshToken(docId, newRefreshToken, oldRefreshToken) {
    await this.collection.doc(docId).update({
      refreshToken: newRefreshToken,
      refreshTokensUsed: FieldValue.arrayUnion(oldRefreshToken),
      updatedAt: new Date().toISOString()
    });
  }

  async deleteByUserId(userId) {
    const existing = await this.getByUserId(userId);
    if (existing) {
      await this.collection.doc(existing.id).delete();
    }
  }

  async deleteById(docId) {
    await this.collection.doc(docId).delete();
  }
}
