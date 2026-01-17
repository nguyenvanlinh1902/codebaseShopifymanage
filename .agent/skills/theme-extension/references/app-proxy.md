# App Proxy Integration

## Configure in shopify.app.toml

```toml
[app_proxy]
url = "https://<firebase-url>/clientApi"
subpath = "app-name"
subpath_prefix = "apps"
```

## Fetch Data via App Proxy

```liquid
{% comment %}
  App proxy URL: /apps/app-name/endpoint
  Shopify adds shop param automatically
{% endcomment %}

{% assign api_url = shop.url | append: '/apps/app-name/data/' | append: resource.id %}
```

## Backend Handler

```javascript
// clientApi controller - receives 'shop' query param from app proxy
export async function getData(ctx) {
  const shopDomain = ctx.query.shop;
  const {id} = ctx.params;

  const shop = await shopRepository.getShopByShopifyDomain(shopDomain);
  if (!shop) {
    ctx.body = {success: false, error: 'Shop not found'};
    return;
  }

  const data = await service.getData(shop.id, id);
  ctx.body = data;
}
```

## Frontend Fetch

```javascript
// JavaScript fetch from storefront
const response = await fetch('/apps/app-name/data?productId=' + productId);
const data = await response.json();
```

## App Proxy Query Parameters

App proxy automatically adds these parameters:

| Parameter | Description |
|-----------|-------------|
| `shop` | Shop domain (e.g., `mystore.myshopify.com`) |
| `logged_in_customer_id` | Customer ID if logged in |
| `path_prefix` | The subpath prefix |
| `timestamp` | Request timestamp |
| `signature` | HMAC signature |

## Signature Verification

```javascript
import crypto from 'crypto';

function verifyAppProxySignature(query) {
  const {signature, ...params} = query;

  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('');

  const calculated = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(sortedParams)
    .digest('hex');

  return signature === calculated;
}
```
