import {BotApiAuditLogRepository} from '../repositories/bot-api-audit-log-repository.js';

const repo = new BotApiAuditLogRepository();

const USED_SAMPLE_WINDOW_MS = 5 * 60 * 1000;
const lastUsedWriteAt = new Map();

async function safeAppend(event) {
  try {
    await repo.append(event);
  } catch (err) {
    console.warn('[bot-api-audit] append failed', event.event, err.message);
  }
}

export function logCreated({keyPrefix, userId, ip, userAgent, name}) {
  return safeAppend({event: 'created', keyPrefix, userId, ip: ip || null, userAgent: userAgent || null, name: name || null});
}

export function logRevoked({keyPrefix, userId, ip, actorUserId}) {
  return safeAppend({event: 'revoked', keyPrefix, userId, actorUserId: actorUserId || null, ip: ip || null});
}

/** Always-on audit: fires on every token delegation (not sampled — security-sensitive). */
export function logTokenDelegated({keyPrefix, userId, provider, count, targets, ip, userAgent}) {
  return safeAppend({
    event: 'token-delegated',
    keyPrefix,
    userId,
    provider,
    count: count || 0,
    targets: Array.isArray(targets) ? targets.slice(0, 20) : [],
    ip: ip || null,
    userAgent: userAgent || null
  });
}

/**
 * Sampling: write at most one `used` event per key per 5 minutes.
 * Avoids 1 Firestore write per request while preserving liveness signal.
 */
export function logUsedSampled({keyPrefix, userId, ip, userAgent, path, method, statusCode}) {
  const now = Date.now();
  const last = lastUsedWriteAt.get(keyPrefix) || 0;
  if (now - last < USED_SAMPLE_WINDOW_MS) return Promise.resolve();
  lastUsedWriteAt.set(keyPrefix, now);
  return safeAppend({
    event: 'used',
    keyPrefix,
    userId,
    ip: ip || null,
    userAgent: userAgent || null,
    path: path || null,
    method: method || null,
    statusCode: statusCode || null
  });
}

/** Testing helper. */
export function _resetAuditSampler() {
  lastUsedWriteAt.clear();
}
