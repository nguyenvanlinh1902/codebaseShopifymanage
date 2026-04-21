/**
 * One-time migration: stamp every pre-existing `discord_sent_emails` doc with
 * the `groupId` of the store that originally claimed it, so the new group-scoped
 * dedup layer treats already-forwarded emails as already-sent under the group
 * that replaced their legacy per-store scope.
 *
 * Does NOT rename existing docIds (preserves audit trail). Adds `groupId` field
 * alongside the existing `storeId`. Idempotent — re-running is safe.
 *
 * Run: node packages/functions/src/scripts/migrate-sent-email-scope.mjs [--dry-run]
 */
import {initializeApp, getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');

if (!getApps().length) initializeApp();
const db = getFirestore();

async function loadStoreGroupMap() {
  const snap = await db.collection('shopify_stores').get();
  const map = new Map();
  for (const d of snap.docs) map.set(d.id, d.data().groupId || null);
  return map;
}

async function run() {
  const storeGroups = await loadStoreGroupMap();
  let processed = 0;
  let updated = 0;
  let skippedNoGroup = 0;
  let skippedAlreadyStamped = 0;

  const pageSize = 500;
  let last = null;
  while (true) {
    let q = db.collection('discord_sent_emails').orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];

    let batch = db.batch();
    let writes = 0;
    for (const doc of snap.docs) {
      processed++;
      const data = doc.data();
      if (data.groupId) {
        skippedAlreadyStamped++;
        continue;
      }
      const groupId = data.storeId ? storeGroups.get(data.storeId) : null;
      if (!groupId) {
        skippedNoGroup++;
        continue;
      }
      if (DRY) {
        console.log(`[migrate][dry-run] ${doc.id} ← groupId=${groupId}`);
        continue;
      }
      batch.update(doc.ref, {groupId});
      writes++;
      updated++;
      if (writes >= 400) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (!DRY && writes > 0) await batch.commit();
  }

  console.log(
    `[migrate] processed=${processed} updated=${updated} skippedNoGroup=${skippedNoGroup} skippedAlreadyStamped=${skippedAlreadyStamped}`
  );
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[migrate] FATAL:', err);
    process.exit(1);
  });
