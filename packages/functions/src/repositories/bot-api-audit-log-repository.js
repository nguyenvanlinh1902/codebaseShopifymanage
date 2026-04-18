import {getFirestore, Timestamp} from 'firebase-admin/firestore';

const COLLECTION = 'bot_api_audit_log';
const TTL_DAYS = 90;

export class BotApiAuditLogRepository {
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

  async append(event) {
    const now = new Date();
    const expireAt = Timestamp.fromDate(new Date(now.getTime() + TTL_DAYS * 24 * 3600 * 1000));
    const doc = {
      ...event,
      timestamp: now.toISOString(),
      expireAt
    };
    await this.collection.add(doc);
  }
}
