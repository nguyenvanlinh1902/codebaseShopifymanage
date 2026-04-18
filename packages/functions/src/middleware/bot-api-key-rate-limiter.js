/**
 * In-memory sliding-window rate limiter for bot API keys.
 * MVP: per-instance only. Effective cap = 60 × instance_count req/min.
 * TODO(post-MVP): replace with Firestore counter doc or Redis when traffic > 1k req/day per key.
 */
const LIMIT = 60;
const WINDOW_MS = 60_000;

const buckets = new Map();

export function checkRateLimit(keyPrefix) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = buckets.get(keyPrefix) || [];
  const timestamps = existing.filter(t => t > cutoff);

  if (timestamps.length >= LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000));
    buckets.set(keyPrefix, timestamps);
    return {allowed: false, retryAfter};
  }

  timestamps.push(now);
  buckets.set(keyPrefix, timestamps);
  return {allowed: true};
}

/** Testing helper. */
export function _resetRateLimiter() {
  buckets.clear();
}
