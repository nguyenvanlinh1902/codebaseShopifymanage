# HMAC Verification

## Popup Signature

```javascript
import crypto from 'crypto';

function verifyPopupSignature(ctx) {
  const {shopId, customerId, timestamp, signature} = ctx.query;

  // Reject old requests
  if (Date.now() - parseInt(timestamp) > 5 * 60 * 1000) return false;

  const expected = crypto
    .createHmac('sha256', process.env.POPUP_SECRET)
    .update(`${shopId}:${customerId}:${timestamp}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

## Shopify Webhook

```javascript
function verifyShopifyWebhook(ctx) {
  const hmac = ctx.get('X-Shopify-Hmac-Sha256');
  const calculated = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(ctx.request.rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(calculated));
}
```

## Webhook Vulnerabilities

| Pattern | Risk |
|---------|------|
| HMAC bypass headers | CRITICAL |
| No HMAC verification | HIGH |
| Missing timestamp validation | MEDIUM |
| String comparison with `===` | MEDIUM - timing attack |

## Best Practices

| Do | Don't |
|----|-------|
| Use `crypto.timingSafeEqual` | Compare strings with `===` |
| Validate timestamps | Accept old requests |
| Use environment variables for secrets | Hardcode secrets |
| Log failed verifications | Silently ignore failures |

## Generate Signature (for testing)

```javascript
function generateSignature(shopId, customerId, timestamp, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${shopId}:${customerId}:${timestamp}`)
    .digest('hex');
}
```
