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
  return data;
}

/**
 * Fetch shop info from Shopify Admin API using access token.
 */
async function fetchShopInfo(shopDomain, accessToken) {
  const url = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/shop.json`;
  const response = await fetch(url, {
    headers: {'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json'}
  });

  if (!response.ok) {
    console.error('[fetchShopInfo] Failed:', response.status);
    return {};
  }

  const data = await response.json();
  return data.shop || {};
}

/**
 * Ensure a valid offline access token exists for the store.
 * Returns the access token or null on failure.
 */
async function ensureOfflineToken(shopDomain, sessionToken, currentToken) {
  // Already have a valid offline token
  if (currentToken && currentToken.startsWith('shpat_')) {
    return currentToken;
  }

  console.log('[ensureOfflineToken] Exchanging session token for offline token...');
  const tokenData = await exchangeForOfflineToken(shopDomain, sessionToken);
  if (!tokenData?.access_token) {
    console.error('[ensureOfflineToken] Token exchange returned no access_token');
    return null;
  }

  return tokenData.access_token;
}

/**
 * Verify JWT signature and payload from App Bridge session token.
 * Returns decoded payload or null if invalid.
 */
function verifySessionToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', shopifyConfig.apiSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (expectedSignature !== signatureB64) return null;

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

  // Check expiration and not-before
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now + 10) return null;

  return payload;
}

/**
 * Extract normalized shop domain from JWT payload.
 */
function extractShopDomain(payload) {
  const dest = payload.dest || payload.iss || '';
  return (
    dest
      .replace(/^https?:\/\//, '')
      .replace(/\.myshopify\.com.*$/, '')
      .trim()
      .toLowerCase() || null
  );
}

/**
 * Middleware to verify Shopify session token (JWT) from App Bridge.
 *
 * Flow: Validate JWT → Token exchange (if needed) → Lookup/create store
 * Supports both existing stores and first-time installs via Shopify Managed Installation.
 */
export async function verifyShopifySession(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({success: false, error: 'Missing session token'});
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Step 1: Validate JWT signature + expiration
    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({success: false, error: 'Invalid or expired session token'});
    }

    // Step 2: Extract shop domain
    const shopDomain = extractShopDomain(payload);
    if (!shopDomain) {
      return res.status(401).json({success: false, error: 'Cannot extract shop domain from token'});
    }

    req.shopDomain = shopDomain;
    req.sessionToken = payload;

    // Step 3: Lookup existing store
    let store = await storeRepo.getByShopDomain(shopDomain);

    if (store) {
      // Step 4a: Existing store — ensure offline token is valid
      const offlineToken = await ensureOfflineToken(shopDomain, token, store.accessToken);
      const updateData = {lastConnected: new Date().toISOString()};

      // Reactivate if previously uninstalled (merchant reinstalled)
      if (store.status === 'uninstalled') {
        updateData.status = 'active';
        store.status = 'active';
        console.log('[verifyShopifySession] Store reactivated after reinstall:', shopDomain);
      }

      if (offlineToken && offlineToken !== store.accessToken) {
        updateData.accessToken = offlineToken;
        store.accessToken = offlineToken;
      }

      // Batch update: token + status + lastConnected in single write
      if (updateData.accessToken || updateData.status) {
        await storeRepo.update(store.id, updateData);
        console.log('[verifyShopifySession] Store updated for:', shopDomain);
      }
    } else {
      // Step 4b: First install via Shopify Managed — token exchange then create store
      console.log('[verifyShopifySession] New store detected, provisioning:', shopDomain);

      const tokenData = await exchangeForOfflineToken(shopDomain, token);
      if (!tokenData?.access_token) {
        return res
          .status(401)
          .json({success: false, error: 'Token exchange failed. Cannot provision store.'});
      }

      // Fetch shop info using the new access token
      const shopInfo = await fetchShopInfo(shopDomain, tokenData.access_token);

      store = await storeRepo.create({
        userId: shopDomain,
        shopDomain,
        accessToken: tokenData.access_token,
        name: shopInfo.name || shopDomain,
        email: shopInfo.email || '',
        currency: shopInfo.currency || '',
        timezone: shopInfo.timezone || '',
        planName: shopInfo.plan_display_name || '',
        shopOwner: shopInfo.shop_owner || '',
        phone: shopInfo.phone || '',
        country: shopInfo.country_name || '',
        niche: '',
        status: 'active',
        installedVia: 'managed-installation',
        scopes: tokenData.scope || '',
        connectedAt: new Date().toISOString(),
        lastConnected: new Date().toISOString()
      });

      console.log('[verifyShopifySession] Store provisioned:', store.id, shopDomain);
    }

    req.store = store;
    next();
  } catch (error) {
    console.error('[verifyShopifySession] Error:', error);
    return res.status(500).json({success: false, error: 'Session verification failed'});
  }
}
