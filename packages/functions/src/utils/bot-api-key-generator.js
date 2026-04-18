import crypto from 'crypto';

const KEY_REGEX = /^bot_[a-f0-9]{32}$/;
const RAW_LENGTH = 36;
const PREFIX_LENGTH = 8;

/** Generate a brand-new raw bot API key and matching hash/prefix. */
export function generateRawKey() {
  const raw = 'bot_' + crypto.randomBytes(16).toString('hex');
  const keyPrefix = raw.slice(4, 4 + PREFIX_LENGTH);
  const keyHash = hashKey(raw);
  return {raw, keyPrefix, keyHash};
}

/** SHA256 hex digest of the raw key. */
export function hashKey(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Return first 8 chars after `bot_` if the raw key format is valid, else null. */
export function parsePrefix(raw) {
  if (typeof raw !== 'string' || raw.length !== RAW_LENGTH) return null;
  if (!KEY_REGEX.test(raw)) return null;
  return raw.slice(4, 4 + PREFIX_LENGTH);
}

/** Timing-safe comparison of raw key against stored sha256 hash. */
export function verifyKey(raw, storedHash) {
  if (typeof raw !== 'string' || typeof storedHash !== 'string') return false;
  const computed = hashKey(raw);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
