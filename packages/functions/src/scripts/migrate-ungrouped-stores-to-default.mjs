/**
 * One-time migration: assign every `shopify_stores` doc without a groupId to a
 * single auto-created "Default Group".
 *
 * Idempotent — safe to re-run. Pass --dry-run to preview only.
 *
 * Run: node packages/functions/src/scripts/migrate-ungrouped-stores-to-default.mjs [--dry-run]
 */
import {initializeApp, getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');
const DEFAULT_GROUP_NAME = 'Default Group';

if (!getApps().length) initializeApp();
const db = getFirestore();

async function ensureDefaultGroup() {
  const snap = await db
    .collection('store_groups')
    .where('name', '==', DEFAULT_GROUP_NAME)
    .limit(1)
    .get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    console.log(`[migrate] Default Group exists: ${doc.id}`);
    return doc.id;
  }
  if (DRY) {
    console.log('[migrate][dry-run] Would create Default Group');
    return '<dry-run-default>';
  }
  const now = new Date().toISOString();
  const ref = await db.collection('store_groups').add({
    name: DEFAULT_GROUP_NAME,
    description: 'Auto-created for ungrouped stores',
    createdBy: 'system-migration',
    createdAt: now,
    updatedAt: now
  });
  console.log(`[migrate] Created Default Group: ${ref.id}`);
  return ref.id;
}

async function run() {
  const defaultGroupId = await ensureDefaultGroup();
  const ungroupedSnap = await db
    .collection('shopify_stores')
    .get();
  const ungrouped = ungroupedSnap.docs.filter(d => !d.data().groupId);

  console.log(`[migrate] ${ungrouped.length} store(s) without groupId`);
  if (ungrouped.length === 0) return;

  if (DRY) {
    for (const d of ungrouped) {
      console.log(`[migrate][dry-run] store=${d.id} → groupId=${defaultGroupId}`);
    }
    return;
  }

  let batch = db.batch();
  let count = 0;
  const now = new Date().toISOString();
  for (const d of ungrouped) {
    batch.update(d.ref, {groupId: defaultGroupId, updatedAt: now});
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`[migrate] Updated ${count} store(s) → Default Group ${defaultGroupId}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[migrate] FATAL:', err);
    process.exit(1);
  });
