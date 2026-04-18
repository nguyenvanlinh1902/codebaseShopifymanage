import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {generateRawKey} from '../utils/bot-api-key-generator.js';

const COLLECTION = 'bot_api_keys';

/**
 * Bot API Key Repository.
 * DocId = 8-char keyPrefix → O(1) lookup on hot auth path.
 * Only the SHA256 hash is stored. Raw key is returned ONCE by `create()`.
 */
export class BotApiKeyRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection(COLLECTION);
    return this._collection;
  }

  /**
   * Create and persist a new bot API key.
   * Returns `{raw, ...record}` — `raw` MUST be handed to the user immediately; never stored.
   */
  async create({userId, name, storeIds = [], expiresAt = null, createdByIp = null, createdByUsername = null}) {
    const {raw, keyPrefix, keyHash} = generateRawKey();
    const now = new Date().toISOString();
    const record = {
      id: keyPrefix,
      keyHash,
      keyPrefix,
      userId,
      storeIds: Array.isArray(storeIds) ? storeIds : [],
      scopes: [],
      name: name || 'Unnamed Key',
      createdAt: now,
      expiresAt: expiresAt || null,
      lastUsedAt: null,
      requestCount: 0,
      revokedAt: null,
      createdByIp: createdByIp || null,
      createdByUsername: createdByUsername || null
    };
    await this.collection.doc(keyPrefix).set(record);
    return {raw, ...record};
  }

  /** Hot-path lookup by prefix. Returns full doc (incl. hash) or null. */
  async getByPrefix(keyPrefix) {
    const doc = await this.collection.doc(keyPrefix).get();
    return doc.exists ? doc.data() : null;
  }

  /** Active (non-revoked) keys for a user, newest first. */
  async listByUser(userId) {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('revokedAt', '==', null)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(d => d.data());
  }

  /** Every key across all admins. Used by the shared-admin-pool UI. */
  async listAll({includeRevoked = false} = {}) {
    let query = this.collection.orderBy('createdAt', 'desc');
    if (!includeRevoked) query = query.where('revokedAt', '==', null);
    const snapshot = await query.get();
    return snapshot.docs.map(d => d.data());
  }

  /** Increment usage counters. Fire-and-forget friendly (no read first). */
  async updateUsage(keyPrefix) {
    try {
      await this.collection.doc(keyPrefix).update({
        lastUsedAt: new Date().toISOString(),
        requestCount: FieldValue.increment(1)
      });
    } catch (err) {
      console.warn('[bot-api-key-repo] updateUsage failed', keyPrefix, err.message);
    }
  }

  /** Soft-revoke: sets revokedAt. Idempotent. */
  async revoke(keyPrefix) {
    await this.collection.doc(keyPrefix).update({
      revokedAt: new Date().toISOString()
    });
  }
}
