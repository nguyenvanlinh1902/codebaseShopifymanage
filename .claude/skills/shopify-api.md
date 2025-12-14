# Shopify API Best Practices

## API Version Check (CRITICAL)

**Always verify API version before implementing!**

Shopify deprecates API versions regularly. Check:
1. Current API version in `shopify.app.toml` or app config
2. Shopify release notes for breaking changes
3. Use Shopify MCP tools to verify current schema

```javascript
// Check what version your app uses
// shopify.app.toml
[api]
api_version = "2024-10"  // Verify this matches your implementation
```

**Common Breaking Changes:**
- Field renames (e.g., `priceV2` → `price`)
- Deprecated mutations replaced with new ones
- Changed input/output types
- Removed fields

---

## API Selection Guide

| Need | Solution | Search Docs For |
|------|----------|-----------------|
| Customize checkout UI | Checkout UI Extension | "checkout ui extension" |
| Apply discounts | Discount Function | "discount function" |
| Validate cart | Cart Validation Function | "cart validation function" |
| Customize shipping | Delivery Customization | "delivery customization" |
| Customize payments | Payment Customization | "payment customization" |
| React to events | Webhooks | "webhooks" |
| Read/write data | GraphQL Admin API | "admin api" |
| Sync large data | Bulk Operations | "bulk operations" |
| Store custom data | Metafields/Metaobjects | "metafields" |
| Admin UI | Admin UI Extension | "admin ui extension" |
| Customer account | Customer Account Extension | "customer account extension" |
| Theme blocks | Theme App Extension | "theme app extension" |

---

## GraphQL Admin API

### Basic Query

```javascript
const query = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      variants(first: 10) {
        nodes {
          id
          price
        }
      }
    }
  }
`;

const response = await shopify.graphql(query, { id: productId });
```

### Pagination

```javascript
async function getAllProducts(shopify) {
  const products = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query getProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node { id title }
          }
        }
      }
    `;

    const response = await shopify.graphql(query, { cursor });
    const { edges, pageInfo } = response.products;

    products.push(...edges.map(e => e.node));
    hasNextPage = pageInfo.hasNextPage;
    cursor = edges[edges.length - 1]?.cursor;
  }

  return products;
}
```

---

## Bulk Operations (ALWAYS Consider First)

**Before implementing any Shopify data sync, ask: "Can this hit API limits?"**

**Rate Limits Context:**
- Regular metafield API: **2 requests/second**, **40 requests/minute**
- Bulk Operations: **No rate limits** - runs server-side on Shopify

### Common Scenarios Requiring Bulk Operations

| Task | Use Bulk? | Why |
|------|-----------|-----|
| Sync all customers | ✅ Yes | Shops have 10k-1M+ customers |
| Sync all products | ✅ Yes | Can be 10k+ products |
| Update customer metafields | ✅ Yes | 1 API call per customer = rate limit |
| Sync all orders | ✅ Yes | High volume shops = millions |
| **Tier launch (mass update)** | ✅ Yes | Thousands of customers at once |
| **Mass tag sync** | ✅ Yes | Avoids 429 errors |
| Get single product | ❌ No | One-off query |
| Update one metafield | ❌ No | Single mutation |

### Volume Decision Guide

| Volume | Strategy |
|--------|----------|
| < 50 items | Regular GraphQL |
| 50-500 items | Batch with Cloud Tasks + rate limiting |
| **500+ items** | **Bulk Operations API** |
| **100k+ items** | **Bulk Operations + chunking (50K lines/chunk)** |

**For detailed bulk mutation patterns, see:** `.claude/skills/shopify-bulk-operations.md`

### Run Bulk Query

```javascript
const mutation = `
  mutation bulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation { id status }
      userErrors { field message }
    }
  }
`;

const bulkQuery = `
  {
    customers {
      edges {
        node {
          id
          email
          metafields(first: 10) {
            edges { node { key value } }
          }
        }
      }
    }
  }
`;

await shopify.graphql(mutation, { query: bulkQuery });
```

### Poll for Completion

```javascript
async function pollBulkOperation(shopify) {
  const query = `
    query {
      currentBulkOperation {
        id
        status
        url
        errorCode
      }
    }
  `;

  while (true) {
    const { currentBulkOperation } = await shopify.graphql(query);

    if (currentBulkOperation.status === 'COMPLETED') {
      return currentBulkOperation.url; // JSONL file URL
    }

    if (currentBulkOperation.status === 'FAILED') {
      throw new Error(currentBulkOperation.errorCode);
    }

    await sleep(5000); // Poll every 5s
  }
}
```

---

## Rate Limiting

### Retry Strategy

| Scenario | Strategy |
|----------|----------|
| Quick retry (< 30s) | In-function backoff |
| Longer delay needed | Cloud Tasks |
| Batch job failed | Cron retry |

### Cloud Tasks (Recommended for Rate Limits)

```javascript
// ❌ BAD: In-function sleep wastes CPU time
await sleep(60000); // 60s sleep = 60s CPU billed

// ✅ GOOD: Schedule retry with Cloud Tasks
const { CloudTasksClient } = require('@google-cloud/tasks');
const client = new CloudTasksClient();

async function scheduleRetry(payload, delaySeconds) {
  await client.createTask({
    parent: client.queuePath(project, location, 'shopify-retry'),
    task: {
      httpRequest: {
        url: `${baseUrl}/api/retry-shopify`,
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        headers: { 'Content-Type': 'application/json' }
      },
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + delaySeconds
      }
    }
  });
}

// Usage in handler
try {
  await shopify.graphql(mutation);
} catch (error) {
  if (error.extensions?.code === 'THROTTLED') {
    await scheduleRetry({ mutation, variables }, 60); // Retry in 60s
    return { success: true, queued: true };
  }
  throw error;
}
```

### Quick In-Function Retry (Short Delays Only)

```javascript
// Only for delays < 5 seconds
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.extensions?.code === 'THROTTLED' && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
        continue;
      }
      throw error;
    }
  }
}
```

---

## Metafields

### Set Metafields (Batch)

```javascript
const mutation = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

await shopify.graphql(mutation, {
  metafields: [
    {
      ownerId: customerId,
      namespace: 'loyalty',
      key: 'points',
      type: 'number_integer',
      value: '500'
    },
    {
      ownerId: customerId,
      namespace: 'loyalty',
      key: 'tier',
      type: 'single_line_text_field',
      value: 'Gold'
    }
  ]
});
```

---

## Webhooks

### Response Time (CRITICAL)

**Must respond within 5 seconds!**

```javascript
// ❌ BAD: Heavy processing (may timeout)
app.post('/webhooks/orders/create', async (req, res) => {
  await calculatePoints(req.body);
  await updateCustomer(req.body);
  await syncToShopify(req.body);
  res.status(200).send('OK');
});

// ✅ GOOD: Queue and respond fast
app.post('/webhooks/orders/create', async (req, res) => {
  // Quick validation
  if (!verifyHmac(req)) {
    return res.status(401).send('Unauthorized');
  }

  // Queue for background processing
  await webhookQueueRef.add({
    type: 'orders/create',
    payload: req.body
  });

  // Respond immediately
  res.status(200).send('OK');
});
```

### HMAC Verification

```javascript
import crypto from 'crypto';

function verifyHmac(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = req.rawBody;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(hash)
  );
}
```

---

## App Bridge (Direct API)

### When to Use

| Scenario | Use App Bridge | Use Firebase API |
|----------|---------------|------------------|
| Simple Shopify CRUD | ✅ Yes | ❌ No |
| Need Firestore data | ❌ No | ✅ Yes |
| Complex business logic | ❌ No | ✅ Yes |
| Background processing | ❌ No | ✅ Yes |

### Direct API Call

```javascript
import { authenticatedFetch } from '@shopify/app-bridge/utilities';

async function fetchProducts(app) {
  const response = await authenticatedFetch(app)(
    '/admin/api/2024-04/graphql.json',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ products(first: 10) { nodes { id title } } }`
      })
    }
  );

  return response.json();
}
```

**Benefits:**
- Faster (no Firebase roundtrip)
- Lower cost (no function invocation)
- Uses shop's session directly