import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_schedules';

/**
 * Discord Schedule Repository — per-store scheduled email digest config.
 * Timezone: all times stored as UTC ISO strings. UI + cron convert to Asia/Ho_Chi_Minh.
 */
export class DiscordScheduleRepository {
  constructor() {
    this._db = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    return this.db.collection(COLLECTION_NAME);
  }

  async getByStoreId(storeId) {
    const doc = await this.collection.doc(storeId).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async upsert(storeId, data) {
    const nowIso = new Date().toISOString();
    const existing = await this.getByStoreId(storeId);
    const payload = {
      storeId,
      ...data,
      updatedAt: nowIso,
      ...(existing ? {} : {createdAt: nowIso})
    };
    await this.collection.doc(storeId).set(payload, {merge: true});
    return this.getByStoreId(storeId);
  }

  async updateRunStats(storeId, {lastRunAt, nextRunAt, lastRunStats}) {
    await this.collection.doc(storeId).update({
      lastRunAt,
      nextRunAt,
      lastRunStats,
      updatedAt: new Date().toISOString()
    });
  }

  async listDue(now = new Date()) {
    const snap = await this.collection
      .where('enabled', '==', true)
      .where('nextRunAt', '<=', now.toISOString())
      .get();
    return snap.docs.map(d => ({id: d.id, ...d.data()}));
  }

  async delete(storeId) {
    await this.collection.doc(storeId).delete();
  }
}
