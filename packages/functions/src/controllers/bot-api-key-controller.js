import {BotApiKeyRepository} from '../repositories/bot-api-key-repository.js';
import {logCreated, logRevoked} from '../services/bot-api-audit-service.js';

const repo = new BotApiKeyRepository();

/** Remove `keyHash` from response; never leak the hash to the frontend. */
function sanitize(doc) {
  if (!doc) return null;
  const {keyHash: _h, ...rest} = doc;
  return rest;
}

/** GET /api/bot-api-keys — shared admin pool: returns ALL keys, newest first. */
export async function listKeys(req, res) {
  try {
    const includeRevoked = req.query.includeRevoked === 'true';
    const keys = await repo.listAll({includeRevoked});
    return res.json({success: true, data: keys.map(sanitize)});
  } catch (err) {
    console.error('[bot-api-keys] list error', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** POST /api/bot-api-keys — mint a new key for the calling admin. Returns raw ONCE. */
export async function createKey(req, res) {
  try {
    const {name, storeIds, expiresAt} = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({success: false, error: 'name is required'});
    }
    if (expiresAt && isNaN(Date.parse(expiresAt))) {
      return res.status(400).json({success: false, error: 'expiresAt must be an ISO date'});
    }

    const {raw, ...record} = await repo.create({
      userId: req.userId,
      createdByUsername: req.username || null,
      name: name.trim(),
      storeIds: Array.isArray(storeIds) ? storeIds.filter(s => typeof s === 'string') : [],
      expiresAt: expiresAt || null,
      createdByIp: req.ip || null
    });

    logCreated({
      keyPrefix: record.keyPrefix,
      userId: req.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
      name: record.name
    }).catch(() => {});

    return res.json({success: true, data: {key: sanitize(record), raw}});
  } catch (err) {
    console.error('[bot-api-keys] create error', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** POST /api/bot-api-keys/:id/revoke — soft revoke. Any admin can revoke any key. */
export async function revokeKey(req, res) {
  try {
    const {id} = req.params;
    const existing = await repo.getByPrefix(id);
    if (!existing) {
      return res.status(404).json({success: false, error: 'Key not found'});
    }
    if (existing.revokedAt) {
      return res.json({success: true, data: {alreadyRevoked: true}});
    }

    await repo.revoke(id);

    logRevoked({
      keyPrefix: id,
      userId: existing.userId,
      actorUserId: req.userId,
      ip: req.ip
    }).catch(() => {});

    return res.json({success: true, data: {revoked: true}});
  } catch (err) {
    console.error('[bot-api-keys] revoke error', err);
    return res.status(500).json({success: false, error: err.message});
  }
}
