import crypto from 'crypto';
import shopifyConfig from '@functions/config/shopify';

const APP_SECRET = shopifyConfig.secret;
const TEST_KEY = '8994018398f0f2199f3fe9805211f40f1938c0c5f47e134d668ee7504c8cf06a';

/**
 * Verify Shopify webhook HMAC signature
 * @param ctx
 * @param next
 * @returns {Promise<*>}
 */
export default async function verifyWebhook(ctx, next) {
  const rawBody = ctx.req.rawBody;
  const secret = await getSecret(ctx);
  const hmac = getHmac(ctx);

  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (hmac !== generatedHash) {
    console.error('Cannot verify webhook because of wrong shared secret');
    ctx.body = {
      success: false,
      message: 'Cannot verify webhook because of wrong shared secret'
    };
    return;
  }

  return next();
}

/**
 * Get the secret key for verification
 * @param ctx
 * @returns {Promise<string>}
 */
async function getSecret(ctx) {
  const isTest = ctx.get('x-shopify-test') && ctx.get('user-agent') !== 'Shopify-Captain-Hook';
  return isTest ? TEST_KEY : APP_SECRET;
}

/**
 * Get HMAC from request header
 * @param ctx
 * @returns {string}
 */
function getHmac(ctx) {
  return ctx.get('X-Shopify-Hmac-Sha256');
}
