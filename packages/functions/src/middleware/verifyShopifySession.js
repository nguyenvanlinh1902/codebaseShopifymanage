import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const storeRepo = new StoreRepository();

/**
 * Exchange App Bridge session token for an offline access token (shpat_)
 * using Shopify's Token Exchange API.
 */
async function exchangeForOfflineToken(shopDomain, sessionToken) {
  const url = `https://${shopDomain}.myshopify.com/admin/oauth/access_token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: shopifyConfig.apiKey,
      client_secret: shopifyConfig.apiSecret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id-token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TokenExchange] Failed:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  console.log('[TokenExchange] Success:', {
    tokenPrefix: data.access_token?.substring(0, 10),
    tokenLength: data.access_token?.length,
    scope: data.scope
  });
  return data.access_token;
}

/**
 * Middleware to verify Shopify session token (JWT) from App Bridge.
 * Extracts shop domain and attaches store info to request.
 */
export async function verifyShopifySession(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[verifyShopifySession] Missing or invalid Authorization header');
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

    console.log('[verifyShopifySession] shopDomain:', shopDomain);

    try {
      const store = await storeRepo.getByShopDomain(shopDomain);

      if (!store) {
        console.error('[verifyShopifySession] Store not found for:', shopDomain);
        return res.status(404).json({success: false, error: 'Store not found. Please reinstall the app.'});
      }

      // Auto-upgrade: if stored token is shpua_ (online), exchange for shpat_ (offline)
      if (!store.accessToken || !store.accessToken.startsWith('shpat_')) {
        console.log('[verifyShopifySession] Token needs upgrade, exchanging for offline token...');
        const offlineToken = await exchangeForOfflineToken(shopDomain, token);
        if (offlineToken && offlineToken.startsWith('shpat_')) {
          await storeRepo.update(store.id, {accessToken: offlineToken});
          store.accessToken = offlineToken;
          console.log('[verifyShopifySession] Token upgraded to shpat_ successfully');
        } else {
          console.warn('[verifyShopifySession] Token exchange failed, keeping existing token');
        }
      }

      req.store = store;
      console.log('[verifyShopifySession] Store:', store.id, 'shopDomain:', store.shopDomain);
      next();
    } catch (err) {
      console.error('[verifyShopifySession] Error:', err);
      return res.status(500).json({success: false, error: 'Failed to verify store'});
    }
  } catch (error) {
    console.error('[verifyShopifySession] Token verification error:', error);
    return res.status(401).json({success: false, error: 'Invalid session token'});
  }
}
