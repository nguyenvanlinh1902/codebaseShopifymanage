import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';

/**
 * Middleware to verify Shopify webhook HMAC signature.
 * Reusable for all webhook endpoints including GDPR.
 */
export function verifyWebhookHmac(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!shopifyConfig.apiSecret || !hmacHeader) {
    console.error('[WebhookHMAC] Missing API secret or HMAC header');
    return res.status(401).json({success: false, error: 'Unauthorized'});
  }

  const generatedHmac = crypto
    .createHmac('sha256', shopifyConfig.apiSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(generatedHmac)
    );

    if (!isValid) {
      console.error('[WebhookHMAC] HMAC verification failed');
      return res.status(401).json({success: false, error: 'Unauthorized'});
    }
  } catch {
    console.error('[WebhookHMAC] HMAC comparison error');
    return res.status(401).json({success: false, error: 'Unauthorized'});
  }

  next();
}
