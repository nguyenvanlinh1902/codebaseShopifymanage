import {BotApiKeyRepository} from '../repositories/bot-api-key-repository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {parsePrefix, verifyKey} from '../utils/bot-api-key-generator.js';

const repo = new BotApiKeyRepository();
const userRepo = new AdminUserRepository();

/** Throwable marker so middleware can produce 401/429 JSON consistently. */
export class BotAuthError extends Error {
  constructor(message, {status = 401, code} = {}) {
    super(message);
    this.name = 'BotAuthError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Validate `x-api-key` and return principal info.
 * Performs: format check → prefix lookup → timing-safe hash compare →
 *           revoked/expiry gates → fresh user role lookup.
 * Never returns or logs the raw key.
 */
export async function authenticateWithApiKey(rawKey) {
  const keyPrefix = parsePrefix(rawKey);
  if (!keyPrefix) {
    throw new BotAuthError('Invalid API key format', {code: 'INVALID_FORMAT'});
  }

  const doc = await repo.getByPrefix(keyPrefix);
  if (!doc) {
    throw new BotAuthError('API key not found', {code: 'NOT_FOUND'});
  }

  if (!verifyKey(rawKey, doc.keyHash)) {
    throw new BotAuthError('Invalid API key', {code: 'INVALID_KEY'});
  }

  if (doc.revokedAt) {
    throw new BotAuthError('API key revoked', {code: 'REVOKED'});
  }

  if (doc.expiresAt && new Date(doc.expiresAt) <= new Date()) {
    throw new BotAuthError('API key expired', {code: 'EXPIRED'});
  }

  const user = await userRepo.getById(doc.userId);
  if (!user) {
    throw new BotAuthError('Key owner no longer exists', {code: 'OWNER_MISSING'});
  }
  if (user.status === 'inactive') {
    throw new BotAuthError('Key owner deactivated', {code: 'OWNER_INACTIVE'});
  }

  // Sanitized key doc — NEVER include keyHash.
  const botKey = {
    id: doc.id,
    keyPrefix: doc.keyPrefix,
    userId: doc.userId,
    storeIds: doc.storeIds || [],
    scopes: doc.scopes || [],
    name: doc.name,
    createdAt: doc.createdAt
  };

  return {
    userId: user.id,
    username: user.username,
    userRole: user.role || 'staff',
    botKey
  };
}

export const botApiKeyRepo = repo;
