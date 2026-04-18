import {test, before} from 'node:test';
import assert from 'node:assert/strict';

/**
 * Repository-level integration test.
 * Requires Firestore emulator + admin SDK. Auto-skips if the emulator env is not set.
 * Run:
 *   firebase emulators:exec --only firestore \
 *     "node --test packages/functions/src/__tests__/integration"
 */

const shouldRun = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

before(() => {
  if (!shouldRun) {
    console.log('⚠ skipping integration — FIRESTORE_EMULATOR_HOST not set');
  }
});

test('repo.create → getByPrefix → revoke round-trip', {skip: !shouldRun}, async () => {
  const {initializeApp, getApps} = await import('firebase-admin/app');
  if (!getApps().length) initializeApp({projectId: process.env.GCLOUD_PROJECT || 'demo-bot-api'});

  const {BotApiKeyRepository} = await import('../../repositories/bot-api-key-repository.js');
  const repo = new BotApiKeyRepository();

  const {raw, keyPrefix} = await repo.create({
    userId: 'u_test',
    name: 'IntegrationKey',
    createdByIp: '127.0.0.1'
  });

  assert.match(raw, /^bot_[a-f0-9]{32}$/);

  const doc = await repo.getByPrefix(keyPrefix);
  assert.ok(doc, 'doc should exist after create');
  assert.equal(doc.userId, 'u_test');
  assert.equal(doc.revokedAt, null);
  assert.equal(typeof doc.keyHash, 'string');

  await repo.revoke(keyPrefix);
  const after = await repo.getByPrefix(keyPrefix);
  assert.ok(after.revokedAt, 'revokedAt should be set');
});

test('listAll with and without includeRevoked', {skip: !shouldRun}, async () => {
  const {BotApiKeyRepository} = await import('../../repositories/bot-api-key-repository.js');
  const repo = new BotApiKeyRepository();

  const {keyPrefix: p1} = await repo.create({userId: 'u_listing', name: 'Active'});
  const {keyPrefix: p2} = await repo.create({userId: 'u_listing', name: 'Revoked'});
  await repo.revoke(p2);

  const active = await repo.listAll({includeRevoked: false});
  assert.ok(active.some(k => k.id === p1));
  assert.ok(!active.some(k => k.id === p2));

  const all = await repo.listAll({includeRevoked: true});
  assert.ok(all.some(k => k.id === p2));
});
