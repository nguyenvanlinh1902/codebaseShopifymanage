import crypto from 'crypto';
import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';
import {cleanupStoreOnUninstall} from '../services/webhook-registration-service.js';

const storeRepo = new StoreRepository();

/**
 * Verify Shopify HMAC signature from query parameters
 */
function verifyHmac(query) {
  const {hmac, ...params} = query;
  delete params.signature;
  if (!hmac || !shopifyConfig.apiSecret) return false;

  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', shopifyConfig.apiSecret)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(generatedHmac));
  } catch {
    return false;
  }
}

/**
 * Verify Shopify webhook HMAC signature from request body
 */
export function verifyWebhookHmac(body, hmacHeader) {
  if (!shopifyConfig.apiSecret || !hmacHeader) return false;

  const generatedHmac = crypto
    .createHmac('sha256', shopifyConfig.apiSecret)
    .update(body, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(generatedHmac)
    );
  } catch {
    return false;
  }
}

/**
 * Normalize shop domain to just the subdomain
 */
function normalizeShopDomain(shop) {
  if (!shop) return null;
  return shop
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com.*$/, '')
    .trim()
    .toLowerCase();
}

/**
 * GET /api/auth/shopify?shop=mystore.myshopify.com
 * Step 1: Redirect to Shopify OAuth consent screen
 */
export async function initiateInstall(req, res) {
  try {
    const {shop, force} = req.query;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter. Use ?shop=yourstore.myshopify.com'
      });
    }

    const shopDomain = normalizeShopDomain(shop);
    if (!shopDomain) {
      return res.status(400).json({success: false, error: 'Invalid shop domain'});
    }

    // If store already installed AND no force param, skip OAuth and redirect to embedded app
    const existingStore = await storeRepo.getByShopDomain(shopDomain);
    if (existingStore && existingStore.status === 'active' && existingStore.accessToken && !force) {
      const embeddedUrl = `https://${shopDomain}.myshopify.com/admin/apps/${shopifyConfig.apiKey}`;
      return res.redirect(embeddedUrl);
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${shopifyConfig.appUrl}/api/auth/shopify/callback`;

    const authUrl =
      `https://${shopDomain}.myshopify.com/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(shopifyConfig.apiKey)}` +
      `&scope=${encodeURIComponent(shopifyConfig.scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    return res.redirect(authUrl);
  } catch (error) {
    console.error('Initiate install error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/auth/shopify/callback?code=xxx&shop=xxx&hmac=xxx&state=xxx
 * Step 2: Shopify redirects back after merchant grants permissions
 */
export async function handleCallback(req, res) {
  try {
    const {code, shop, hmac} = req.query;

    if (!code || !shop || !hmac) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (code, shop, hmac)'
      });
    }

    if (!verifyHmac(req.query)) {
      return res.status(401).json({success: false, error: 'HMAC verification failed'});
    }

    const shopDomain = normalizeShopDomain(shop);

    // Exchange authorization code for access token
    const tokenUrl = `https://${shopDomain}.myshopify.com/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        client_id: shopifyConfig.apiKey,
        client_secret: shopifyConfig.apiSecret,
        code
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(400).json({success: false, error: 'Failed to exchange authorization code'});
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).json({success: false, error: 'No access token received'});
    }

    // Get shop info from Shopify API
    const shopInfoUrl = `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/shop.json`;
    const shopInfoResponse = await fetch(shopInfoUrl, {
      headers: {'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json'}
    });

    let shopInfo = {};
    if (shopInfoResponse.ok) {
      const shopInfoData = await shopInfoResponse.json();
      shopInfo = shopInfoData.shop || {};
    }

    // Save or update store in Firestore
    const existingStore = await storeRepo.getByShopDomain(shopDomain);

    const storeData = {
      accessToken,
      name: shopInfo.name || shopDomain,
      email: shopInfo.email || '',
      currency: shopInfo.currency || '',
      timezone: shopInfo.timezone || '',
      planName: shopInfo.plan_display_name || '',
      shopOwner: shopInfo.shop_owner || '',
      phone: shopInfo.phone || '',
      country: shopInfo.country_name || '',
      status: 'active',
      installedVia: 'shopify-oauth',
      scopes: tokenData.scope || '',
      lastConnected: new Date().toISOString()
    };

    if (existingStore) {
      await storeRepo.update(existingStore.id, storeData);
    } else {
      await storeRepo.create({
        userId: shopDomain, // Use shop domain as unique userId
        shopDomain,
        niche: '',
        connectedAt: new Date().toISOString(),
        ...storeData
      });
    }

    console.log(`Shopify app installed on: ${shopDomain}`);

    // Webhooks are managed declaratively via shopify.app.toml
    // Shopify auto-registers them on install (orders/create, fulfillments/*, customers/*)

    // Redirect to the embedded app in Shopify Admin
    const embeddedUrl = `https://${shopDomain}.myshopify.com/admin/apps/${shopifyConfig.apiKey}`;
    return res.redirect(embeddedUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/auth/shopify/webhook/app/uninstalled
 * Shopify calls this when a merchant uninstalls the app
 */
export async function handleUninstall(req, res) {
  try {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!verifyWebhookHmac(rawBody, hmacHeader)) {
      console.error('Webhook HMAC verification failed');
      return res.status(401).json({success: false, error: 'Unauthorized'});
    }

    const shopDomain = normalizeShopDomain(
      req.get('X-Shopify-Shop-Domain') || req.body?.myshopify_domain
    );

    if (!shopDomain) {
      return res.status(400).json({success: false, error: 'Missing shop domain'});
    }

    console.log(`App uninstalled from: ${shopDomain}`);

    const store = await storeRepo.getByShopDomain(shopDomain);
    if (store) {
      await storeRepo.update(store.id, {
        status: 'uninstalled',
        accessToken: '',
        uninstalledAt: new Date().toISOString()
      });

      // Cleanup Firestore webhook records and deactivate sync configs
      await cleanupStoreOnUninstall(store.id);
    }

    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Uninstall webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
