/**
 * One-time migration: for each store group that does not yet have a
 * `discord_group_config`, copy Discord config from the OLDEST store in the
 * group (per validation 2026-04-19, oldest createdAt wins on token conflict).
 * Same for `discord_group_schedules` from the oldest store's `discord_schedules`.
 *
 * Skipped stores whose tokens/channels differ from the chosen one are logged so
 * the admin can audit and reconcile manually via the UI.
 *
 * Run: node packages/functions/src/scripts/migrate-discord-per-group.mjs [--dry-run]
 * Prerequisite: run migrate-ungrouped-stores-to-default.mjs first.
 */
import {initializeApp, getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');

if (!getApps().length) initializeApp();
const db = getFirestore();

async function getStoresInGroup(groupId) {
  const snap = await db
    .collection('shopify_stores')
    .where('groupId', '==', groupId)
    .get();
  return snap.docs
    .map(d => ({id: d.id, ...d.data()}))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

async function getStoreDiscordConfig(storeId) {
  const snap = await db
    .collection('discord_config')
    .where('storeId', '==', storeId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return {id: snap.docs[0].id, ...snap.docs[0].data()};
}

async function getStoreSchedule(storeId) {
  const doc = await db.collection('discord_schedules').doc(storeId).get();
  if (!doc.exists) return null;
  return {id: doc.id, ...doc.data()};
}

async function migrateGroup(group) {
  const stores = await getStoresInGroup(group.id);
  if (stores.length === 0) {
    console.log(`[migrate] Skip group=${group.id} name=${group.name} — no stores`);
    return;
  }

  // Load existing configs in createdAt order. Oldest active config wins.
  const candidates = [];
  for (const s of stores) {
    const cfg = await getStoreDiscordConfig(s.id);
    if (cfg?.botToken && cfg?.channelId && cfg.isActive !== false) {
      candidates.push({store: s, cfg});
    }
  }

  if (candidates.length === 0) {
    console.log(`[migrate] group=${group.id} — no store has active Discord config`);
    return;
  }

  const winner = candidates[0];
  const others = candidates.slice(1);

  const existingGroup = await db.collection('discord_group_config').doc(group.id).get();
  if (existingGroup.exists) {
    console.log(`[migrate] group=${group.id} already has group config, skip copy`);
  } else {
    const payload = {
      groupId: group.id,
      botToken: winner.cfg.botToken,
      channelId: winner.cfg.channelId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (DRY) {
      console.log(`[migrate][dry-run] group=${group.id} ← store=${winner.store.id} config`);
    } else {
      await db.collection('discord_group_config').doc(group.id).set(payload);
      console.log(`[migrate] group=${group.id} ← store=${winner.store.id} config copied`);
    }
  }

  if (others.length > 0) {
    const skipped = others
      .filter(o => o.cfg.botToken !== winner.cfg.botToken || o.cfg.channelId !== winner.cfg.channelId)
      .map(o => o.store.id);
    if (skipped.length > 0) {
      console.warn(
        `[migrate] group=${group.id} CONFLICT — skipped stores with different token/channel: ${skipped.join(', ')}`
      );
    }
  }

  // Schedule migration (winner store only; idempotent).
  const sched = await getStoreSchedule(winner.store.id);
  if (!sched) return;
  const existingGroupSched = await db.collection('discord_group_schedules').doc(group.id).get();
  if (existingGroupSched.exists) return;

  const now = new Date().toISOString();
  const schedPayload = {
    groupId: group.id,
    enabled: !!sched.enabled,
    intervalHours: sched.intervalHours || 24,
    sourceAccounts: sched.sourceAccounts || [],
    nextRunAt: sched.nextRunAt || null,
    lastRunAt: sched.lastRunAt || null,
    lastRunStats: sched.lastRunStats || null,
    createdAt: now,
    updatedAt: now
  };
  if (DRY) {
    console.log(`[migrate][dry-run] group=${group.id} ← store=${winner.store.id} schedule`);
  } else {
    await db.collection('discord_group_schedules').doc(group.id).set(schedPayload);
    console.log(`[migrate] group=${group.id} ← store=${winner.store.id} schedule copied`);
  }
}

async function run() {
  const groups = await db.collection('store_groups').get();
  console.log(`[migrate] ${groups.size} group(s) to process`);
  for (const doc of groups.docs) {
    await migrateGroup({id: doc.id, ...doc.data()});
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[migrate] FATAL:', err);
    process.exit(1);
  });
