import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_global_config';
const SINGLETON_ID = 'default';

/**
 * Global Discord bot config — single document shared across all store groups.
 * Each group stores only its `channelId`; the bot token lives here.
 */
export class DiscordGlobalConfigRepository {
  constructor() {
    this._db = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get ref() {
    return this.db.collection(COLLECTION_NAME).doc(SINGLETON_ID);
  }

  async get() {
    const doc = await this.ref.get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async upsert(data) {
    const now = new Date().toISOString();
    const existing = await this.get();
    const payload = {
      ...data,
      updatedAt: now,
      ...(existing ? {} : {createdAt: now})
    };
    await this.ref.set(payload, {merge: true});
    return this.get();
  }

  async delete() {
    await this.ref.delete();
  }
}
