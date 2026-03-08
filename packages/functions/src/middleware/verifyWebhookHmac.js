import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const storeRepo = new StoreRepository();

/**
 * Verify HMAC with a given secret
 */
function verifyHmacWithSecret(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false;
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
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
 * Middleware to verify Shopify webhook HMAC signature.
 * Supports multi-app stores by looking up partner's client_secret.
 */
export async function verifyWebhookHmac(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!hmacHeader) {
    console.error('[WebhookHMAC] Missing HMAC header');
    return res.status(401).json({success: false, error: 'Unauthorized'});
  }

  // Try main app secret first
  if (verifyHmacWithSecret(rawBody, hmacHeader, shopifyConfig.apiSecret)) {
    return next();
  }

  // Fallback: look up store's partnerClientSecret for multi-app stores
  const shopDomain = (req.get('X-Shopify-Shop-Domain') || '')
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com.*$/, '')
    .trim()
    .toLowerCase();

  if (shopDomain) {
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (store?.partnerClientSecret && verifyHmacWithSecret(rawBody, hmacHeader, store.partnerClientSecret)) {
      return next();
    }
  }

  console.error('[WebhookHMAC] HMAC verification failed for:', shopDomain || 'unknown');
  return res.status(401).json({success: false, error: 'Unauthorized'});
}
