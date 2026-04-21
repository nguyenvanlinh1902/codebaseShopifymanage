import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DiscordSentEmailRepository} from '../../repositories/discord-sent-email-repository.js';

test('buildGroupDocId is unique per (group, provider, email, messageId)', () => {
  const a = DiscordSentEmailRepository.buildGroupDocId('gA', 'gmail', 'x@y.com', 'm1');
  const b = DiscordSentEmailRepository.buildGroupDocId('gB', 'gmail', 'x@y.com', 'm1');
  assert.notEqual(a, b); // same email can be claimed in two different groups
  assert.equal(a, 'group:gA:gmail:x@y.com:m1');
});

test('buildGroupDocId differs from legacy buildDocId (no collision)', () => {
  const legacy = DiscordSentEmailRepository.buildDocId('gmail', 'x@y.com', 'm1');
  const groupScoped = DiscordSentEmailRepository.buildGroupDocId('gA', 'gmail', 'x@y.com', 'm1');
  assert.ok(!groupScoped.startsWith(legacy));
  assert.ok(groupScoped.startsWith('group:'));
});

test('same inputs produce same docId (deterministic)', () => {
  const id1 = DiscordSentEmailRepository.buildGroupDocId('g1', 'outlook', 'a@b.com', 'zzz');
  const id2 = DiscordSentEmailRepository.buildGroupDocId('g1', 'outlook', 'a@b.com', 'zzz');
  assert.equal(id1, id2);
});
