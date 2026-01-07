---
name: api-design
description: Use this skill when the user asks to "create an API endpoint", "build a REST API", "add a controller", "design an API", "implement CRUD operations", "add validation", "handle API errors", or any backend API development work. Provides REST API design patterns, response formats, validation, and best practices.
---

# REST API Design (packages/functions)

> For **security patterns**, see `security` skill

## CRITICAL: Firebase/Koa Context

In Firebase Functions with Koa, the request body is accessed differently than standard Koa:

```javascript
// ❌ WRONG - Standard Koa (does NOT work in Firebase)
const data = ctx.request.body;

// ✅ CORRECT - Firebase/Koa
const data = ctx.req.body;
```

| Property | Access Pattern |
|----------|----------------|
| Request body | `ctx.req.body` |
| Query params | `ctx.query` |
| URL params | `ctx.params` |
| Response body | `ctx.body = {...}` |
| State/context | `ctx.state` |

---

## Directory Structure

```
packages/functions/src/
├── routes/              # Route definitions
│   ├── api.js           # Admin API routes
│   ├── restApiV2.js     # Public REST API v2
│   └── apiHookV1.js     # Webhook routes
├── controllers/         # Request handlers
├── middleware/          # Auth, validation, rate limiting
├── validations/         # Yup schemas
└── helpers/
    └── restApiResponse.js  # Response helpers
```

---

## Response Format

### Response Helpers

```javascript
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  itemResponse
} from '../helpers/restApiResponse';

// Single item
ctx.body = itemResponse(customer);

// Paginated list
ctx.body = paginatedResponse(customers, pageInfo, total);

// Error
ctx.status = 400;
ctx.body = errorResponse('Invalid email', 'VALIDATION_ERROR', 400);
```

### Response Structure

| Type | Format |
|------|--------|
| Success | `{success: true, data, meta, timestamp}` |
| Error | `{success: false, error: {message, code, statusCode}, timestamp}` |
| Paginated | `{success: true, data: [], meta: {pagination: {...}}}` |

---

## HTTP Status Codes

| Code | When to Use |
|------|-------------|
| 200 | Successful GET, PUT |
| 201 | Successful POST (created) |
| 204 | Successful DELETE |
| 400 | Validation error, malformed request |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 422 | Business logic error |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Route Design

### RESTful Conventions

| Action | Method | Route |
|--------|--------|-------|
| List | GET | `/resources` |
| Get one | GET | `/resources/:id` |
| Create | POST | `/resources` |
| Update | PUT | `/resources/:id` |
| Delete | DELETE | `/resources/:id` |
| Action | POST | `/resources/:id/action` |

### Route Organization

```javascript
import Router from 'koa-router';

const router = new Router({prefix: '/api/v2'});

router.use(verifyAuthenticate);
router.use(verifyPlanAccess);

// Resources
router.get('/customers', validateQuery(paginationSchema), getCustomers);
router.get('/customers/:id', getCustomer);
router.post('/customers', validateInput(createSchema), createCustomer);
router.put('/customers/:id', validateInput(updateSchema), updateCustomer);

// Sub-resources
router.get('/customers/:id/rewards', getCustomerRewards);

// Actions
router.post('/customers/:id/points/award', awardPoints);
```

---

## Input Validation

### Yup Schemas

```javascript
import * as Yup from 'yup';

export const createCustomerSchema = Yup.object({
  email: Yup.string().email().required(),
  firstName: Yup.string().max(100).optional(),
  points: Yup.number().positive().optional()
});

export const paginationSchema = Yup.object({
  limit: Yup.number().min(1).max(100).default(20),
  cursor: Yup.string().optional()
});
```

### Validation Middleware

```javascript
export function validateInput(schema) {
  return async (ctx, next) => {
    try {
      ctx.request.body = await schema.validate(ctx.request.body, {
        stripUnknown: true
      });
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.body = errorResponse(error.message, 'VALIDATION_ERROR', 400);
    }
  };
}
```

---

## Controller Pattern

```javascript
export async function getOne(ctx) {
  try {
    const {shop} = ctx.state;
    const {id} = ctx.params;

    const resource = await repository.getById(shop.id, id);

    if (!resource) {
      ctx.status = 404;
      ctx.body = errorResponse('Not found', 'NOT_FOUND', 404);
      return;
    }

    ctx.body = itemResponse(pick(resource, publicFields));
  } catch (error) {
    console.error('Error:', error);
    ctx.status = 500;
    ctx.body = errorResponse('Server error', 'INTERNAL_ERROR', 500);
  }
}
```

---

## Pagination

### Cursor-Based (Preferred)

```javascript
// Request
GET /api/customers?limit=20&cursor=eyJpZCI6IjEyMyJ9

// Response
{
  "data": [...],
  "meta": {
    "pagination": {
      "hasNext": true,
      "nextCursor": "eyJpZCI6IjE0MyJ9",
      "limit": 20
    }
  }
}
```

---

## Error Codes

| Code | When |
|------|------|
| `UNAUTHORIZED` | Missing/invalid credentials |
| `FORBIDDEN` | No permission |
| `PLAN_RESTRICTED` | Feature not in plan |
| `VALIDATION_ERROR` | Invalid input |
| `NOT_FOUND` | Resource doesn't exist |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## Best Practices

| Do | Don't |
|----|-------|
| Use response helpers | Return raw objects |
| Set correct status codes | Return 200 for errors |
| Validate all inputs | Trust user input |
| Pick response fields | Expose internal fields |
| Scope queries by shopId | Query without shop filter |
| Use cursor pagination | Use offset at scale |

---

## Checklist

```
□ Uses response helpers (successResponse/errorResponse)
□ Correct HTTP status codes
□ Input validated with Yup schema
□ Queries scoped by shopId
□ Response fields picked (no internal data)
□ Error handling with try-catch
□ Rate limiting applied
□ Authentication middleware
```

---

## Client API (Storefront Public Endpoints)

For **public-facing storefront endpoints** accessed via Shopify App Proxy. Different from admin API - no authentication, shop identified by query param.

### Directory Structure

```
packages/functions/src/
├── routes/
│   └── clientApi.js           # Public storefront routes
├── controllers/
│   └── clientApi/             # Storefront handlers
│       └── featureClientController.js
└── presenters/
    └── featurePresenter.js    # Strip PII before response
```

### Route Configuration

```javascript
// routes/clientApi.js
import Router from 'koa-router';
import * as featureController from '../controllers/clientApi/featureClientController';

const router = new Router({prefix: '/clientApi'});

// No authentication middleware - public endpoints
// Shop identified via app proxy 'shop' query param

// Read endpoints
router.get('/feature/:resourceId', featureController.getResource);
router.get('/feature/bulk', featureController.getBulkResources);

// Write endpoints (may check logged_in_customer_id)
router.post('/feature', featureController.submitResource);

// Settings (filtered for storefront)
router.get('/feature/settings', featureController.getSettings);

export default router;
```

### Shop Resolution Pattern

App Proxy automatically adds `shop` query parameter. Resolve shop in controller:

```javascript
// Helper function in controller
async function getShopFromQuery(ctx) {
  const shopDomain = ctx.query.shop || ctx.query.shopifyDomain;

  if (!shopDomain) {
    return {shop: null, error: 'Missing shop parameter'};
  }

  const shop = await shopRepository.getShopByShopifyDomain(shopDomain);
  if (!shop) {
    return {shop: null, error: 'Shop not found'};
  }

  return {shop, error: null};
}
```

### Controller Pattern

```javascript
// controllers/clientApi/featureClientController.js
import * as featureService from '../../services/featureService';
import {presentForStorefront} from '../../presenters/featurePresenter';

export async function getResource(ctx) {
  const {resourceId} = ctx.params;
  const {limit, cursor} = ctx.query;

  // Resolve shop from app proxy
  const {shop, error} = await getShopFromQuery(ctx);
  if (error) {
    ctx.body = {success: false, error};
    return;
  }

  const result = await featureService.getResource(shop.id, resourceId, {
    limit: limit ? parseInt(limit, 10) : 10,
    startAfter: cursor
  });

  // CRITICAL: Strip PII before returning to storefront
  ctx.body = {
    ...result,
    data: {
      ...result.data,
      items: presentForStorefront(result.data.items)
    }
  };
}
```

### Customer Context (Optional)

App Proxy passes `logged_in_customer_id` for authenticated customers:

```javascript
export async function submitResource(ctx) {
  const inputData = ctx.req.body;

  const {shop, error} = await getShopFromQuery(ctx);
  if (error) {
    ctx.body = {success: false, error};
    return;
  }

  // Get customer ID from app proxy if logged in
  const customerId = ctx.query.logged_in_customer_id || null;
  if (customerId) {
    inputData.customerId = customerId;
  }

  const result = await featureService.createResource(shop.id, inputData);
  ctx.body = result;
}
```

### Bulk Endpoints with Limits

Protect against abuse with array size limits:

```javascript
export async function getBulkResources(ctx) {
  let {ids} = ctx.query;

  const {shop, error} = await getShopFromQuery(ctx);
  if (error) {
    ctx.body = {success: false, error};
    return;
  }

  // Handle comma-separated string
  if (typeof ids === 'string') {
    ids = ids.split(',').map(id => id.trim());
  }

  // CRITICAL: Limit array size to prevent abuse
  if (ids.length > 100) {
    ctx.body = {success: false, error: 'Maximum 100 items allowed'};
    return;
  }

  const result = await featureService.getBulkResources(shop.id, ids);
  ctx.body = result;
}
```

### Settings Exposure

Only expose settings needed for storefront rendering:

```javascript
export async function getSettings(ctx) {
  const {shop, error} = await getShopFromQuery(ctx);
  if (error) {
    ctx.body = {success: false, error};
    return;
  }

  const result = await featureService.getSettings(shop.id);

  // Only expose necessary settings for storefront
  ctx.body = {
    success: true,
    data: {
      enabled: result.data.enabled,
      primaryColor: result.data.primaryColor
      // Don't expose: internalFlags, adminSettings, etc.
    }
  };
}
```

### Presenter Pattern (Strip PII)

```javascript
// presenters/featurePresenter.js

export function presentForStorefront(item) {
  if (!item) return null;

  // Destructure to exclude sensitive fields
  // eslint-disable-next-line no-unused-vars
  const {email, customerId, shopId, internalId, ...safeItem} = item;

  return safeItem;
}

export function presentListForStorefront(items) {
  if (!Array.isArray(items)) return [];
  return items.map(presentForStorefront);
}
```

### Client API Checklist

```
□ Shop resolved from ctx.query.shop (app proxy)
□ No authentication middleware (public)
□ PII stripped via presenters before response
□ Array inputs have size limits
□ Settings expose only needed fields
□ Customer ID from logged_in_customer_id (optional)
□ Proper error responses for missing shop
```

### Client API vs Admin API

| Aspect | Admin API | Client API |
|--------|-----------|------------|
| Auth | JWT/Session | None (app proxy) |
| Shop context | `ctx.state.shop` | `ctx.query.shop` |
| Data exposure | Full (for admin) | Sanitized (no PII) |
| Rate limiting | Per-shop | Per-IP |
| Input limits | Higher | Strict (prevent abuse) |
