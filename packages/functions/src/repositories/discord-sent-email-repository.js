import {getFirestore} from 'firebase-admin/firestore';

const COLLECTION_NAME = 'discord_sent_emails';

/**
 * Tracks emails already forwarded to Discord so the scheduled digest
 * never sends the same message twice.
 * Doc id = `${provider}:${accountEmail}:${messageId}` for O(1) lookup.
 */
export class DiscordSentEmailRepository {
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

  static buildDocId(provider, accountEmail, messageId) {
    return `${provider}:${accountEmail}:${messageId}`;
  }

  async isSent(provider, accountEmail, messageId) {
    const id = DiscordSentEmailRepository.buildDocId(provider, accountEmail, messageId);
    const doc = await this.collection.doc(id).get();
    return doc.exists;
  }

  /**
   * Atomic claim — returns true if successfully claimed (was NOT sent),
   * returns false if already sent by another cron run. Prevents duplicates.
   */
  async claim(storeId, provider, accountEmail, messageId, meta = {}) {
    const id = DiscordSentEmailRepository.buildDocId(provider, accountEmail, messageId);
    const ref = this.collection.doc(id);
    try {
      return await this.db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, {
          storeId,
          provider,
          accountEmail,
          messageId,
          claimedAt: new Date().toISOString(),
          ...meta
        });
        return true;
      });
    } catch (err) {
      console.warn(`[DiscordSent] claim tx failed for ${id}: ${err.message}`);
      return false;
    }
  }

  async markSent(provider, accountEmail, messageId, info = {}) {
    const id = DiscordSentEmailRepository.buildDocId(provider, accountEmail, messageId);
    await this.collection.doc(id).set(
      {
        sentAt: new Date().toISOString(),
        ...info
      },
      {merge: true}
    );
  }

  async markFailed(provider, accountEmail, messageId, errorMsg) {
    const id = DiscordSentEmailRepository.buildDocId(provider, accountEmail, messageId);
    // Delete claim so next run can retry
    await this.collection.doc(id).delete().catch(() => {});
    console.warn(`[DiscordSent] ${id} failed: ${errorMsg}`);
  }

  /**
   * List sent emails for a store with optional date range + cursor pagination.
   * Ordered by sentAt DESC. Requires composite index: storeId ASC + sentAt DESC.
   * @param {object} opts
   * @param {number} opts.limit - Max items per page (default 20).
   * @param {string} opts.from - Lower-bound ISO (inclusive).
   * @param {string} opts.to - Upper-bound ISO (inclusive).
   * @param {string} opts.after - Cursor: last doc's sentAt from previous page.
   */
  async listRecent(storeId, opts = {}) {
    const {limit = 20, from, to, after} = opts;
    let q = this.collection.where('storeId', '==', storeId);
    if (from) q = q.where('sentAt', '>=', from);
    if (to) q = q.where('sentAt', '<=', to);
    q = q.orderBy('sentAt', 'desc');
    if (after) q = q.startAfter(after);
    q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({id: d.id, ...d.data()}));
  }
}
