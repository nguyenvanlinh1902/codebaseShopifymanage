import {StoreRepository} from '../repositories/storeRepository.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {GMAIL_OAUTH_CONFIG} from '../config/gmail-oauth.js';
import {OUTLOOK_OAUTH_CONFIG} from '../config/outlook-oauth.js';
import shopifyConfig from '../config/shopify.js';
import {extractStoreIds} from '../utils/store-access.js';
import {logTokenDelegated} from '../services/bot-api-audit-service.js';

const storeRepo = new StoreRepository();
const userRepo = new AdminUserRepository();
const authRepo = new GoogleAuthRepository();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function asArray(v) {
  return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : [];
}

/**
 * Compute the set of storeIds the caller is allowed to access, intersected with the requested list.
 * Order: botKey.storeIds (if set) → staff assignedStores (if not admin) → requested filter.
 */
async function resolveAllowedStoreIds(req, requestedIds) {
  const botAllow = req.botKey?.storeIds || [];
  let allowed = botAllow.length > 0 ? new Set(botAllow) : null;

  if (req.userRole !== 'admin') {
    const user = await userRepo.getById(req.userId);
    const assigned = extractStoreIds(user?.assignedStores);
    const assignedSet = new Set(assigned);
    allowed = allowed
      ? new Set([...allowed].filter(id => assignedSet.has(id)))
      : assignedSet;
  }

  if (requestedIds.length === 0) {
    return allowed ? [...allowed] : null; // null sentinel = "no filter, return everything the user owns"
  }

  if (!allowed) return requestedIds;
  return requestedIds.filter(id => allowed.has(id));
}

function auditFor(req, provider, targets) {
  logTokenDelegated({
    keyPrefix: req.botKey?.keyPrefix || null,
    userId: req.userId,
    provider,
    count: targets.length,
    targets,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null
  }).catch(() => {});
}

/**
 * POST /api/bot/tokens/shopify
 * Body: { storeIds?: string[] }  — empty = every store the bot can reach
 * Returns long-lived Shopify Admin access tokens so the bot can call GraphQL directly
 * (Order search, Customer search, Products, etc.) in parallel across stores.
 */
export async function delegateShopifyTokens(req, res) {
  try {
    const requested = asArray(req.body?.storeIds);
    const allowedIds = await resolveAllowedStoreIds(req, requested);

    // allowedIds=null → admin without any filter: return every store in the system.
    // Staff access has already been intersected against assignedStores in resolveAllowedStoreIds,
    // so getByIds is safe (no extra ownership check needed — assignedStores allow cross-user delegation).
    const stores = allowedIds === null
      ? await storeRepo.getAll()
      : allowedIds.length === 0
        ? []
        : await storeRepo.getByIds(allowedIds);

    const data = stores
      .filter(s => s && s.accessToken && s.shopDomain)
      .map(s => ({
        storeId: s.id,
        shopDomain: s.shopDomain,
        name: s.name || null,
        accessToken: s.accessToken,
        apiVersion: shopifyConfig.apiVersion,
        graphqlUrl: `https://${s.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`
      }));

    auditFor(req, 'shopify', data.map(d => d.storeId));
    return res.json({success: true, data});
  } catch (err) {
    console.error('[bot-delegation] shopify error', err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** Fetch a fresh Google access token via refresh_token grant. */
async function refreshGoogleToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: GMAIL_OAUTH_CONFIG.clientId,
    client_secret: GMAIL_OAUTH_CONFIG.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.error_description || errBody.error || `Google token ${resp.status}`);
  }
  return resp.json();
}

async function refreshOutlookToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: OUTLOOK_OAUTH_CONFIG.clientId,
    client_secret: OUTLOOK_OAUTH_CONFIG.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const resp = await fetch(OUTLOOK_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.error_description || errBody.error || `Outlook token ${resp.status}`);
  }
  return resp.json();
}

/** Shared: load google_auth records for a set of stores filtered by authType. */
async function loadAuthRecords(req, storeIds, authTypeFilter) {
  const batches = await Promise.all(
    storeIds.map(sid =>
      req.userRole === 'admin'
        ? authRepo.getAllByStore(sid)
        : authRepo.getAllByStoreAndUser(sid, req.userId)
    )
  );
  return batches.flat().filter(authTypeFilter);
}

async function delegateMailTokens(req, res, {provider, refreshFn, includeWhere}) {
  try {
    const requestedStoreIds = asArray(req.body?.storeIds);
    const emailsFilter = asArray(req.body?.emails);
    const allowedIds = await resolveAllowedStoreIds(req, requestedStoreIds);

    // allowedIds === null means admin without any filter — scan every store in the system plus the shared "default" bucket.
    let uniqueStoreIds;
    if (allowedIds === null) {
      const allStores = await storeRepo.getAll();
      uniqueStoreIds = [...new Set([...allStores.map(s => s.id), 'default'])];
    } else {
      uniqueStoreIds = [...new Set(allowedIds)];
    }

    if (uniqueStoreIds.length === 0) {
      return res.json({success: true, data: []});
    }

    const records = await loadAuthRecords(req, uniqueStoreIds, includeWhere);
    const byEmail = new Map();
    for (const r of records) {
      if (emailsFilter.length > 0 && !emailsFilter.includes(r.googleEmail)) continue;
      if (!r.refreshToken) continue;
      if (!byEmail.has(r.googleEmail)) byEmail.set(r.googleEmail, r);
    }

    const data = await Promise.all([...byEmail.values()].map(async r => {
      try {
        const tokens = await refreshFn(r.refreshToken);
        return {
          email: r.googleEmail,
          storeId: r.storeId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || r.refreshToken,
          expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
          scope: tokens.scope || r.scope || null,
          provider
        };
      } catch (err) {
        return {email: r.googleEmail, storeId: r.storeId, error: err.message, provider};
      }
    }));

    auditFor(req, provider, data.map(d => d.email).filter(Boolean));
    return res.json({success: true, data});
  } catch (err) {
    console.error(`[bot-delegation] ${provider} error`, err);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** POST /api/bot/tokens/gmail — body: { storeIds?, emails? } */
export function delegateGmailTokens(req, res) {
  return delegateMailTokens(req, res, {
    provider: 'gmail',
    refreshFn: refreshGoogleToken,
    includeWhere: r => r && r.googleEmail && r.authType !== 'outlook'
  });
}

/** POST /api/bot/tokens/outlook — body: { storeIds?, emails? } */
export function delegateOutlookTokens(req, res) {
  return delegateMailTokens(req, res, {
    provider: 'outlook',
    refreshFn: refreshOutlookToken,
    includeWhere: r => r && r.googleEmail && r.authType === 'outlook'
  });
}
