import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_group_config';

/**
 * Discord Group Config Repository — bot token + channel config per store group.
 * docId = groupId (1:1 with store_groups/{groupId}).
 */
export class DiscordGroupConfigRepository {
  constructor() {
    this._db = null;
    this._collection = null;
  }

  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get collection() {
    if (!this._collection) this._collection = this.db.collection(COLLECTION_NAME);
    return this._collection;
  }

  async getByGroupId(groupId) {
    const doc = await this.collection.doc(groupId).get();
    if (!doc.exists) return null;
    return {id: doc.id, ...doc.data()};
  }

  async upsert(groupId, configData) {
    const existing = await this.getByGroupId(groupId);
    const now = new Date().toISOString();

    if (existing) {
      await this.collection.doc(groupId).update({
        ...configData,
        updatedAt: now
      });
      return this.getByGroupId(groupId);
    }

    await this.collection.doc(groupId).set({
      groupId,
      ...configData,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    return this.getByGroupId(groupId);
  }

  async delete(groupId) {
    await this.collection.doc(groupId).delete();
  }
}
