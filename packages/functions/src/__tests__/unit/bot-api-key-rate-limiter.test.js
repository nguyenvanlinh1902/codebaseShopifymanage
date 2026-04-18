import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {checkRateLimit, _resetRateLimiter} from '../../middleware/bot-api-key-rate-limiter.js';

beforeEach(() => _resetRateLimiter());

test('first 60 calls are allowed', () => {
  for (let i = 0; i < 60; i++) {
    const r = checkRateLimit('prefix-a');
    assert.equal(r.allowed, true, `call ${i + 1} should be allowed`);
  }
});

test('61st call within window is blocked with retryAfter', () => {
  for (let i = 0; i < 60; i++) checkRateLimit('prefix-b');
  const r = checkRateLimit('prefix-b');
  assert.equal(r.allowed, false);
  assert.ok(r.retryAfter >= 1 && r.retryAfter <= 60, `retryAfter in [1,60] got ${r.retryAfter}`);
});

test('separate keys have independent buckets', () => {
  for (let i = 0; i < 60; i++) checkRateLimit('prefix-c');
  const r = checkRateLimit('prefix-d');
  assert.equal(r.allowed, true);
});

test('window slides — old timestamps are evicted', async () => {
  const original = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    for (let i = 0; i < 60; i++) checkRateLimit('prefix-e');
    // Advance past the 60-second window.
    now += 61_000;
    const r = checkRateLimit('prefix-e');
    assert.equal(r.allowed, true);
  } finally {
    Date.now = original;
  }
});
