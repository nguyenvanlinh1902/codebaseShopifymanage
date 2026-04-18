import jwt from 'jsonwebtoken';
import {KeyTokenRepository} from '../repositories/keyTokenRepository.js';
import authConfig from '../config/auth.js';
import {authenticateWithApiKey, BotAuthError, botApiKeyRepo} from './bot-api-key-auth.js';
import {checkRateLimit} from './bot-api-key-rate-limiter.js';
import {logUsedSampled} from '../services/bot-api-audit-service.js';

const keyTokenRepo = new KeyTokenRepository();

const HEADERS = {
  CLIENT_ID: 'x-client-id',
  AUTHORIZATION: 'authorization',
  API_KEY: 'x-api-key'
};

export async function authentication(req, res, next) {
  const rawKey = req.headers[HEADERS.API_KEY];
  if (rawKey) return authenticateBotKey(req, res, next, rawKey);
  return authenticateJwt(req, res, next);
}

/** API-key branch: validates, attaches req fields, enforces rate limit, fire-and-forget audit. */
async function authenticateBotKey(req, res, next, rawKey) {
  try {
    const {userId, username, userRole, botKey} = await authenticateWithApiKey(rawKey);

    const limit = checkRateLimit(botKey.keyPrefix);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: limit.retryAfter
      });
    }

    req.userId = userId;
    req.username = username;
    req.userRole = userRole;
    req.botKey = botKey;
    req.authMethod = 'api-key';

    // Fire-and-forget side-effects (never block the response).
    botApiKeyRepo.updateUsage(botKey.keyPrefix).catch(() => {});
    logUsedSampled({
      keyPrefix: botKey.keyPrefix,
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      path: req.path,
      method: req.method
    }).catch(() => {});

    next();
  } catch (err) {
    if (err instanceof BotAuthError) {
      return res.status(err.status).json({success: false, error: err.message, code: err.code});
    }
    console.error('[auth] api-key path unexpected error', err);
    return res.status(500).json({success: false, error: 'Authentication error'});
  }
}

/** JWT branch — byte-identical to the original middleware; DO NOT alter. */
async function authenticateJwt(req, res, next) {
  try {
    const userId = req.headers[HEADERS.CLIENT_ID];
    if (!userId) {
      return res.status(401).json({success: false, error: 'Missing x-client-id header'});
    }

    const keyToken = await keyTokenRepo.getByUserId(userId);
    if (!keyToken) {
      return res.status(401).json({success: false, error: 'Not authenticated'});
    }

    const authHeader = req.headers[HEADERS.AUTHORIZATION];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({success: false, error: 'Missing authorization header'});
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(accessToken, authConfig.jwtSecret);

    if (decoded.userId !== userId) {
      return res.status(401).json({success: false, error: 'Invalid token'});
    }

    req.userId = decoded.userId;
    req.username = decoded.username;
    req.userRole = decoded.role || 'staff';
    req.keyToken = keyToken;
    req.authMethod = 'jwt';

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({success: false, error: 'Invalid token'});
    }
    return res.status(500).json({success: false, error: 'Authentication error'});
  }
}
