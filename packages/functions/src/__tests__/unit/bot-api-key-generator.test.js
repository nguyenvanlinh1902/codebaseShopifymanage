import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateRawKey, hashKey, parsePrefix, verifyKey} from '../../utils/bot-api-key-generator.js';

test('generateRawKey returns bot_<32 hex> with matching prefix and hash', () => {
  const {raw, keyPrefix, keyHash} = generateRawKey();
  assert.match(raw, /^bot_[a-f0-9]{32}$/);
  assert.equal(raw.length, 36);
  assert.equal(keyPrefix, raw.slice(4, 12));
  assert.equal(keyHash, hashKey(raw));
  assert.equal(keyHash.length, 64);
});

test('generateRawKey yields unique raw values', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(generateRawKey().raw);
  assert.equal(seen.size, 500);
});

test('hashKey is deterministic', () => {
  const raw = 'bot_' + 'a'.repeat(32);
  assert.equal(hashKey(raw), hashKey(raw));
});

test('parsePrefix returns prefix for valid key', () => {
  const raw = 'bot_' + 'a'.repeat(32);
  assert.equal(parsePrefix(raw), 'aaaaaaaa');
});

test('parsePrefix returns null for malformed keys', () => {
  assert.equal(parsePrefix('invalid'), null);
  assert.equal(parsePrefix(''), null);
  assert.equal(parsePrefix(null), null);
  assert.equal(parsePrefix('bot_' + 'z'.repeat(32)), null); // non-hex
  assert.equal(parsePrefix('bot_' + 'a'.repeat(31)), null); // wrong length
});

test('verifyKey returns true on match, false on mismatch', () => {
  const {raw, keyHash} = generateRawKey();
  assert.equal(verifyKey(raw, keyHash), true);
  assert.equal(verifyKey(raw, hashKey('bot_' + 'b'.repeat(32))), false);
});

test('verifyKey rejects non-string inputs', () => {
  assert.equal(verifyKey(null, 'x'), false);
  assert.equal(verifyKey('x', null), false);
  assert.equal(verifyKey(undefined, undefined), false);
});
