import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const storeRepo = new StoreRepository();

/**
 * Middleware to verify Shopify session token (JWT) from App Bridge.
 * Extracts shop domain and attaches store info to request.
 */
export function verifyShopifySession(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({success: false, error: 'Missing session token'});
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Decode JWT (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
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

    // Lookup store in background, attach to request
    storeRepo
      .getByShopDomain(shopDomain)
      .then(store => {
        req.store = store;
        next();
      })
      .catch(err => {
        console.error('Error looking up store:', err);
        req.store = null;
        next();
      });
  } catch (error) {
    console.error('Session token verification error:', error);
    return res.status(401).json({success: false, error: 'Invalid session token'});
  }
}
