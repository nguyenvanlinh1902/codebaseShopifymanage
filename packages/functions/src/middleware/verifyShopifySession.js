import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const storeRepo = new StoreRepository();

/**
 * Middleware to verify Shopify session token (JWT) from App Bridge.
 * Extracts shop domain and attaches store info to request.
 * SECURITY: Store lookup is now synchronous to prevent race conditions.
 */
export async function verifyShopifySession(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[verifyShopifySession] Missing or invalid Authorization header:', authHeader);
    return res.status(401).json({success: false, error: 'Missing session token'});
  }

  const token = authHeader.replace('Bearer ', '');
  console.log(
    '[verifyShopifySession] Token received, length:',
    token?.length,
    'starts with:',
    token?.substring(0, 20)
  );

  try {
    // Decode JWT (header.payload.signature)
    const parts = token.split('.');
    console.log('[verifyShopifySession] Token parts:', parts.length);
    if (parts.length !== 3) {
      console.error(
        '[verifyShopifySession] Invalid token format. Parts:',
        parts.length,
        'Token:',
        token.substring(0, 50)
      );
      return res.status(401).json({success: false, error: 'Invalid token format'});
    }

    // Verify signature
    const [headerB64, payloadB64, signatureB64] = parts;
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', shopifyConfig.apiSecret)
      .update(signatureInput)
      .digest('base64url');

    if (expectedSignature !== signatureB64) {
      return res.status(401).json({success: false, error: 'Invalid token signature'});
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({success: false, error: 'Token expired'});
    }

    // Check nbf (not before)
    if (payload.nbf && payload.nbf > now + 10) {
      return res.status(401).json({success: false, error: 'Token not yet valid'});
    }

    // Extract shop domain from iss or dest
    // iss = https://store.myshopify.com/admin
    // dest = https://store.myshopify.com
    const dest = payload.dest || payload.iss || '';
    const shopDomain = dest
      .replace(/^https?:\/\//, '')
      .replace(/\.myshopify\.com.*$/, '')
      .trim()
      .toLowerCase();

    if (!shopDomain) {
      return res.status(401).json({success: false, error: 'Cannot extract shop domain from token'});
    }

    req.shopDomain = shopDomain;
    req.sessionToken = payload;

    // SECURITY FIX: Wait for store lookup to complete BEFORE calling next()
    // This prevents race conditions where req.store might be undefined or wrong
    try {
      const store = await storeRepo.getByShopDomain(shopDomain);
      req.store = store;

      if (!store) {
        console.warn('[verifyShopifySession] Store not found for shop:', shopDomain);
        return res.status(404).json({
          success: false,
          error: 'Store not found. Please reinstall the app.'
        });
      }

      console.log('[verifyShopifySession] Store found:', store.id, 'userId:', store.userId);
      next();
    } catch (err) {
      console.error('[verifyShopifySession] Error looking up store:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify store'
      });
    }
  } catch (error) {
    console.error('Session token verification error:', error);
    return res.status(401).json({success: false, error: 'Invalid session token'});
  }
}
