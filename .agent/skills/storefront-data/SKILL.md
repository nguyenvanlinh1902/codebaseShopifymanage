# Storefront Data Delivery Skill

Use this skill when the user asks about "storefront data", "faster rendering", "avoid API calls", "metafield approach", "app proxy vs metafield", "Liquid data", or any storefront performance optimization.

## Overview

Strategies for delivering app data to the storefront without API calls for faster rendering.

## Approaches Comparison

| Approach | Speed | Complexity | Size Limit | Use Case |
|----------|-------|------------|------------|----------|
| **Shop Metafield** | Fastest | Low | ~512KB | Global config, small-medium data |
| **Product Metafields** | Fast | Medium | ~512KB/product | Per-product data at scale |
| **App Proxy** | Slower | Medium | Unlimited | Large/dynamic data, auth needed |
| **Metaobjects** | Fast | Higher | ~512KB/object | Complex structured data |

## 1. Shop Metafield Pattern (Recommended for Global Data)

Store all feature data in a single shop metafield. Sync on every change.

### Structure
```javascript
// Shop metafield: $app:{feature}
{
  discounts: {
    "12345": { tiers, id, title },     // keyed by product ID
    "__all": { tiers, id, title }      // for "all products" type
  },
  settings: { /* widget config */ },
  updatedAt: "2024-01-01T00:00:00Z"
}
```

### Backend Service
```javascript
// services/shopMetafieldService.js
import {initShopify} from '@functions/services/shopifyService';
import {SHOP_METAFIELD} from '@functions/const/feature';

export async function syncToShopMetafield(shopData, data) {
  const shopify = initShopify(shopData);

  const metafieldData = {
    namespace: SHOP_METAFIELD.NAMESPACE,
    key: SHOP_METAFIELD.KEY,
    value: JSON.stringify(data),
    type: SHOP_METAFIELD.TYPE
  };

  // Check if exists
  const metafields = await shopify.metafield.list({
    metafield: {owner_resource: 'shop'}
  });

  const existing = metafields?.find(
    m => m.namespace === SHOP_METAFIELD.NAMESPACE && m.key === SHOP_METAFIELD.KEY
  );

  if (!existing) {
    await shopify.metafield.create(metafieldData);
  } else {
    await shopify.metafield.update(existing.id, {
      value: JSON.stringify(data),
      type: SHOP_METAFIELD.TYPE
    });
  }

  return {success: true};
}
```

### Constants
```javascript
// const/feature/metafield.js
export const SHOP_METAFIELD = {
  NAMESPACE: '$app:feature',
  KEY: 'config',
  TYPE: 'json',
  OWNER_RESOURCE: 'shop'
};
```

### Liquid Access (Theme Extension)
```liquid
{% comment %} blocks/widget.liquid {% endcomment %}
{% assign config = shop.metafields['$app:feature']['config'].value %}
{% assign product_id = product.id | append: '' %}
{% assign discount = config.discounts[product_id] | default: config.discounts['__all'] %}

{% if discount %}
  <div class="volume-tiers">
    {% for tier in discount.tiers %}
      <div>Buy {{ tier.quantity }}+ get {{ tier.discountValue }}% off</div>
    {% endfor %}
  </div>
{% endif %}
```

### JavaScript Access (Scripttag/Theme Extension)
```javascript
// Get metafield from Liquid-rendered data attribute
const config = JSON.parse(
  document.querySelector('[data-feature-config]')?.dataset.featureConfig || '{}'
);

// Or fetch via Storefront API (requires metafield storefront access)
const response = await fetch('/api/storefront', {
  method: 'POST',
  body: JSON.stringify({
    query: `{ shop { metafield(namespace: "$app:feature", key: "config") { value } } }`
  })
});
```

### When to Sync
```javascript
// Sync after any data change
export async function createDiscount(shopData, data) {
  const id = await repo.create(shopData.id, data);
  
  // Sync to metafield for storefront
  await syncAllToShopMetafield(shopData);
  
  return {success: true, data: {id}};
}
```

## 2. Product Metafields Pattern (For Per-Product Data)

Use when data is product-specific and you have many products.

### Sync Pattern
```javascript
export async function syncProductMetafield(shopData, productId, data) {
  const shopify = initShopify(shopData);
  
  await shopify.graphql(`
    mutation setProductMetafield($input: ProductInput!) {
      productUpdate(input: $input) {
        userErrors { field, message }
      }
    }
  `, {
    input: {
      id: productId,
      metafields: [{
        namespace: '$app:feature',
        key: 'config',
        type: 'json',
        value: JSON.stringify(data)
      }]
    }
  });
}
```

### Liquid Access
```liquid
{% assign config = product.metafields['$app:feature']['config'].value %}
```

## 3. App Proxy Pattern (For Dynamic/Large Data)

Use when data exceeds metafield limits or requires authentication.

### Setup in shopify.app.toml
```toml
[app_proxy]
url = "https://your-app.com/api/proxy"
subpath = "feature"
prefix = "apps"
```

### Backend Handler
```javascript
// handlers/proxyHandler.js
export async function handleProxy(ctx) {
  const {shop, productId} = ctx.req.query;
  
  // Verify request is from Shopify
  if (!verifyProxySignature(ctx.req.query)) {
    return ctx.send({error: 'Unauthorized'}, 401);
  }
  
  const data = await service.getDataForProduct(shop, productId);
  return ctx.send(data);
}
```

### Frontend Fetch
```javascript
// Slower - requires network request
const response = await fetch(`/apps/feature?productId=${productId}`);
const data = await response.json();
```

## Best Practices

### Size Optimization
```javascript
// Minimize metafield size - only include what's needed for display
const buildDiscountEntry = discount => ({
  t: discount.tiers.map(t => ({q: t.quantity, v: t.discountValue})), // shortened keys
  id: discount.id
});
```

### Sync Debouncing
```javascript
// For bulk operations, sync once at the end
export async function bulkUpdate(shopData, ids, data) {
  const results = await Promise.all(
    ids.map(id => updateSingle(shopData, id, data))
  );
  
  // Single sync after all updates
  await syncAllToShopMetafield(shopData);
  
  return results;
}
```

### Metafield Namespace Convention
```javascript
// Use $app: prefix for app-owned metafields
// Format: $app:{app-handle}
const NAMESPACE = '$app:volume-discount';
```

### Enable Storefront Access
```javascript
// GraphQL mutation to make metafield visible to Storefront API
const mutation = `
  mutation enableStorefrontAccess {
    metafieldStorefrontVisibilityCreate(input: {
      namespace: "$app:feature"
      key: "config"
      ownerType: SHOP
    }) {
      userErrors { field, message }
    }
  }
`;
```

## Decision Tree

```
Storefront Data Delivery?
│
├─ GET (read data for display)
│  │
│  ├─ Shopify-only app?
│  │  └─ Metafield → Window Variable (fastest, lowest cost)
│  │
│  └─ Multi-platform app? (Shopify + WooCommerce + BigCommerce)
│     └─ App Proxy API (portable, but higher cost)
│
└─ POST (actions: track, submit, modify)
   └─ App Proxy API (required for mutations)
```

## GET Data: Metafield vs API

| Approach | Speed | Cost | Portability | Use Case |
|----------|-------|------|-------------|----------|
| **Metafield → Window** | Fastest | Free | Shopify-only | Display config, settings, tiers |
| **App Proxy API** | Slower | Per-request | Multi-platform | Dynamic data, cross-platform apps |

### Metafield to Window (Recommended for Shopify-only)

```liquid
{% comment %} Theme App Extension - app-embed.liquid {% endcomment %}
<script>
  window.AVADA_APP_DATA = {
    config: {{ shop.metafields['$app:feature']['config'].value | json }},
    settings: {{ shop.metafields['$app:feature']['settings'].value | json }},
    productData: {{ product.metafields['$app:feature']['data'].value | json }}
  };
</script>
```

**Pros**: Zero API calls, instant load, no server cost
**Cons**: Shopify-specific, 512KB limit, sync on change

### App Proxy API (For Multi-platform or POST actions)

```javascript
// POST action - always needs API
await fetch('/apps/feature/track', {
  method: 'POST',
  body: JSON.stringify({event: 'view', productId})
});

// GET - only if multi-platform needed
const data = await fetch('/apps/feature/config?productId=' + productId);
```

**Pros**: Works on any platform, unlimited size, real-time data
**Cons**: Latency, server costs, rate limits

## Related Skills
- `theme-extension` - Liquid templates and app blocks
- `scripttag` - Lightweight storefront JavaScript
- `shopify-api` - GraphQL mutations for metafields
