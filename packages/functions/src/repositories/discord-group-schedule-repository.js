import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_group_schedules';

/**
 * Discord Group Schedule Repository — per-group scheduled email digest config.
 * Timezone: all times stored as UTC ISO strings. UI + cron convert to Asia/Ho_Chi_Minh.
 * docId = groupId (1:1 with store_groups/{groupId}).
 */
export class DiscordGroupScheduleRepository {
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

  async getByGroupId(groupId) {
    const doc = await this.collection.doc(groupId).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async upsert(groupId, data) {
    const nowIso = new Date().toISOString();
    const existing = await this.getByGroupId(groupId);
    const payload = {
      groupId,
      ...data,
      updatedAt: nowIso,
      ...(existing ? {} : {createdAt: nowIso})
    };
    await this.collection.doc(groupId).set(payload, {merge: true});
    return this.getByGroupId(groupId);
  }

  async updateRunStats(groupId, {lastRunAt, nextRunAt, lastRunStats}) {
    await this.collection.doc(groupId).update({
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

  async delete(groupId) {
    await this.collection.doc(groupId).delete();
  }
}
