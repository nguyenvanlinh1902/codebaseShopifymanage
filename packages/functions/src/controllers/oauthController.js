import {StoreRepository} from '../repositories/storeRepository.js';
import crypto from 'crypto';

const storeRepo = new StoreRepository();

// Scopes needed for the app
const REQUIRED_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_fulfillments',
  'write_fulfillments',
  'read_inventory',
  'write_inventory'
].join(',');

/**
 * Generate Shopify OAuth authorization URL
 */
export async function getAuthUrl(req, res) {
  try {
    const {shopDomain, apiKey, redirectUri} = req.body;

    if (!shopDomain || !apiKey || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'shopDomain, apiKey, and redirectUri are required'
      });
    }

    // Normalize shop domain
    const normalizedDomain = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\.myshopify\.com.*$/, '')
      .trim()
      .toLowerCase();

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Build authorization URL
    const authUrl =
      `https://${normalizedDomain}.myshopify.com/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(apiKey)}` +
      `&scope=${encodeURIComponent(REQUIRED_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    return res.json({
      success: true,
      data: {
        authUrl,
        state,
        shopDomain: normalizedDomain
      }
    });
  } catch (error) {
    console.error('Get auth URL error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle OAuth callback and exchange code for access token
 */
export async function handleCallback(req, res) {
  try {
    const {code, shop, state, apiKey, apiSecret, userId, storeName, niche} = req.body;

    if (!code || !shop || !apiKey || !apiSecret || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Normalize shop domain
    const shopDomain = shop
      .replace(/^https?:\/\//, '')
      .replace(/\.myshopify\.com.*$/, '')
      .trim()
      .toLowerCase();

    // Exchange authorization code for access token
    const tokenUrl = `https://${shopDomain}.myshopify.com/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code: code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(400).json({
        success: false,
        error: 'Failed to exchange authorization code for access token'
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'No access token received'
      });
    }

    // Get shop info using the access token
    const shopInfoUrl = `https://${shopDomain}.myshopify.com/admin/api/2024-01/shop.json`;
    const shopInfoResponse = await fetch(shopInfoUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!shopInfoResponse.ok) {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch shop info'
      });
    }

    const shopInfoData = await shopInfoResponse.json();
    const shopInfo = shopInfoData.shop;

    // Check if store already exists
    const existingStore = await storeRepo.getByShopDomain(shopDomain);
    if (existingStore) {
      // Update existing store
      const updatedStore = await storeRepo.update(existingStore.id, {
        accessToken,
        apiSecret,
        name: storeName || shopInfo.name,
        niche: niche || existingStore.niche || '',
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        status: 'active',
        lastConnected: new Date().toISOString()
      });

      const storeData = {...updatedStore};
      delete storeData.accessToken;
      delete storeData.apiSecret;
      return res.json({
        success: true,
        message: 'Store reconnected successfully',
        data: storeData
      });
    }

    // Create new store
    const store = await storeRepo.create({
      userId,
      shopDomain,
      accessToken,
      apiSecret,
      name: storeName || shopInfo.name,
      niche: niche || '',
      email: shopInfo.email,
      currency: shopInfo.currency,
      timezone: shopInfo.timezone,
      status: 'active',
      connectedAt: new Date().toISOString()
    });

    // Don't send accessToken/apiSecret in response
    const storeData = {...store};
    delete storeData.accessToken;
    delete storeData.apiSecret;

    return res.json({
      success: true,
      message: 'Store connected successfully',
      data: storeData
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Verify HMAC signature for webhooks and OAuth callbacks
 */
export function verifyHmac(query, secret) {
  const {hmac, ...params} = query;

  if (!hmac) {
    return false;
  }

  // Sort and encode parameters
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // Generate HMAC
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(generatedHmac));
}
