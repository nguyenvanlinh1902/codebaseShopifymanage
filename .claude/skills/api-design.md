# REST API Design

## Response Format

### Standard Response Structure

All API endpoints must return consistent format:

```javascript
// Success response
{
  success: true,
  data: responseData,
  meta: { pagination, count, ... },
  timestamp: "2024-01-15T10:30:00.000Z"
}

// Error response
{
  success: false,
  error: {
    message: "Human-readable error message",
    code: "ERROR_CODE",
    statusCode: 400,
    details: { field: "email", reason: "invalid format" }  // Optional
  },
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

### Response Helpers

```javascript
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  itemResponse,
  listResponse
} from '../helpers/restApiResponse';

// Single item
ctx.body = itemResponse(customer);

// List with count
ctx.body = listResponse(customers, totalCount);

// Paginated
ctx.body = paginatedResponse(customers, pageInfo, totalCount);

// Error
ctx.status = 400;
ctx.body = errorResponse('Invalid email format', 'VALIDATION_ERROR', 400);
```

---

## HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST creating resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors, malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, state conflict |
| 422 | Unprocessable | Business logic validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Unexpected server error |

### Status Code Examples

```javascript
// 400 - Bad Request (malformed input)
ctx.status = 400;
ctx.body = errorResponse('Invalid JSON body', 'INVALID_REQUEST', 400);

// 401 - Unauthorized (no/invalid credentials)
ctx.status = 401;
ctx.body = errorResponse('Invalid API key', 'UNAUTHORIZED', 401);

// 403 - Forbidden (valid credentials, no permission)
ctx.status = 403;
ctx.body = errorResponse('Plan does not include this feature', 'PLAN_RESTRICTED', 403);

// 404 - Not Found
ctx.status = 404;
ctx.body = errorResponse('Customer not found', 'NOT_FOUND', 404);

// 422 - Unprocessable (business rule violation)
ctx.status = 422;
ctx.body = errorResponse('Insufficient points balance', 'INSUFFICIENT_POINTS', 422);

// 429 - Rate Limited
ctx.status = 429;
ctx.body = errorResponse('Rate limit exceeded', 'RATE_LIMITED', 429);
```

---

## Route Design

### RESTful Naming Conventions

| Action | Method | Route | Example |
|--------|--------|-------|---------|
| List | GET | `/resources` | `/customers` |
| Get one | GET | `/resources/:id` | `/customers/:customerId` |
| Create | POST | `/resources` | `/customers` |
| Update | PUT | `/resources/:id` | `/customers/:customerId` |
| Partial update | PATCH | `/resources/:id` | `/customers/:customerId` |
| Delete | DELETE | `/resources/:id` | `/customers/:customerId` |
| Action | POST | `/resources/:id/action` | `/customers/:id/redeem` |

### Route Organization

```javascript
import Router from 'koa-router';

const router = new Router({prefix: '/api/v2'});

// Apply global middleware
router.use(verifyAuthenticate);
router.use(verifyPlanAccess);

// =============== CUSTOMERS ===============
router.get('/customers', validateQuery(paginationSchema), getCustomers);
router.get('/customers/:customerId', getCustomer);
router.post('/customers', validateInput(createCustomerSchema), createCustomer);
router.put('/customers/:customerId', validateInput(updateCustomerSchema), updateCustomer);
router.delete('/customers/:customerId', deleteCustomer);

// Sub-resources
router.get('/customers/:customerId/rewards', getCustomerRewards);
router.get('/customers/:customerId/transactions', getCustomerTransactions);

// Actions (use POST for operations)
router.post('/customers/:customerId/points/award', awardPoints);
router.post('/customers/:customerId/points/deduct', deductPoints);

// =============== ORDERS ===============
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrder);
```

### Versioning

```javascript
// Version in URL prefix (recommended)
const router = new Router({prefix: '/api/v2'});

// Or version in header
ctx.get('X-API-Version');  // "2"
```

---

## Input Validation

### Validation Schemas (Yup)

```javascript
import * as Yup from 'yup';

// Request body schema
export const createCustomerSchema = Yup.object({
  email: Yup.string().email().required(),
  firstName: Yup.string().max(100).optional(),
  lastName: Yup.string().max(100).optional(),
  points: Yup.number().positive().optional()
});

// Query params schema
export const paginationSchema = Yup.object({
  limit: Yup.number().min(1).max(100).default(20),
  cursor: Yup.string().optional(),
  sortBy: Yup.string().oneOf(['createdAt', 'updatedAt', 'points']).optional(),
  sortOrder: Yup.string().oneOf(['asc', 'desc']).default('desc')
});

// Conditional validation
export const customerIdentifierSchema = Yup.object()
  .shape({
    customerId: Yup.string(),
    externalId: Yup.string(),
    email: Yup.string().email()
  })
  .test('atLeastOne', 'At least one identifier required', value => {
    return value.customerId || value.externalId || value.email;
  });
```

### Validation Middleware

```javascript
// Validate request body
export function validateInput(schema, options = {}) {
  return async function(ctx, next) {
    try {
      const validated = await schema.validate(ctx.request.body, {
        stripUnknown: true,
        abortEarly: false,
        ...options
      });
      ctx.request.body = validated;
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.body = errorResponse(
        error.errors?.[0] || 'Validation failed',
        'VALIDATION_ERROR',
        400,
        {fields: error.inner?.map(e => ({field: e.path, message: e.message}))}
      );
    }
  };
}

// Validate query params
export function validateQuery(schema) {
  return async function(ctx, next) {
    try {
      const validated = await schema.validate(ctx.query, {stripUnknown: true});
      ctx.query = validated;
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.body = errorResponse(error.message, 'INVALID_QUERY', 400);
    }
  };
}
```

---

## Pagination

### Cursor-Based (Preferred for Large Datasets)

```javascript
// Request
GET /api/customers?limit=20&cursor=eyJpZCI6IjEyMyJ9

// Response
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "hasNext": true,
      "hasPrevious": false,
      "nextCursor": "eyJpZCI6IjE0MyJ9",
      "limit": 20
    }
  }
}
```

### Offset-Based (Simple, Small Datasets)

```javascript
// Request
GET /api/customers?limit=20&page=2

// Response
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrevious": true
    }
  }
}
```

### Implementation

```javascript
async function getCustomers(ctx) {
  const {limit = 20, cursor} = ctx.query;
  const shopId = ctx.state.shop.id;

  const {data, pageInfo, total} = await customerRepository.getList({
    shopId,
    limit,
    cursor
  });

  ctx.body = paginatedResponse(data, pageInfo, total);
}
```

---

## Authentication

### API Key Authentication

```javascript
export default async function verifyAuthenticate(ctx, next) {
  const appKey = ctx.get('X-App-Key');
  const secretKey = ctx.get('X-Secret-Key');

  if (!appKey || !secretKey) {
    ctx.status = 401;
    ctx.body = errorResponse('Missing API credentials', 'UNAUTHORIZED', 401);
    return;
  }

  try {
    const {shop} = await verifyApiKey({appKey, secretKey});

    if (!shop.isInstalled) {
      ctx.status = 401;
      ctx.body = errorResponse('Shop uninstalled', 'SHOP_UNINSTALLED', 401);
      return;
    }

    ctx.state.shop = shop;
    await next();
  } catch (error) {
    ctx.status = 401;
    ctx.body = errorResponse('Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }
}
```

### Plan/Feature Access Control

```javascript
export default async function verifyPlanAccess(ctx, next) {
  const {shop} = ctx.state;
  const requiredPlans = ['pro', 'enterprise'];

  if (!requiredPlans.includes(shop.plan)) {
    ctx.status = 403;
    ctx.body = errorResponse(
      'This feature requires a higher tier plan',
      'PLAN_RESTRICTED',
      403
    );
    return;
  }

  await next();
}
```

---

## Rate Limiting

### Implementation

```javascript
import {FirebaseFunctionsRateLimiter} from 'firebase-functions-rate-limiter';

const limiter = FirebaseFunctionsRateLimiter.withFirestoreBackend({
  name: 'api_rate_limits',
  maxCalls: 120,        // requests
  periodSeconds: 60     // per minute
}, firestore);

async function rateLimitMiddleware(ctx, next) {
  const identifier = ctx.state.shop?.id || ctx.ip;

  try {
    await limiter.rejectOnQuotaExceededOrRecordUsage(identifier);
    await next();
  } catch (e) {
    ctx.status = 429;
    ctx.body = errorResponse('Rate limit exceeded', 'RATE_LIMITED', 429);
  }
}
```

### Rate Limit Headers

```javascript
// Inform clients of rate limit status
ctx.set('X-RateLimit-Limit', '120');
ctx.set('X-RateLimit-Remaining', remaining.toString());
ctx.set('X-RateLimit-Reset', resetTime.toString());
```

---

## Error Handling

### Error Codes

```javascript
export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  PLAN_RESTRICTED: 'PLAN_RESTRICTED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Business Logic
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  RESOURCE_EXPIRED: 'RESOURCE_EXPIRED',
  ENTITY_INACTIVE: 'ENTITY_INACTIVE',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED'
};
```

### Global Error Handler

```javascript
async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', error);

    // Known application errors
    if (error.isAppError) {
      ctx.status = error.statusCode;
      ctx.body = errorResponse(error.message, error.code, error.statusCode);
      return;
    }

    // Validation errors
    if (error.name === 'ValidationError') {
      ctx.status = 400;
      ctx.body = errorResponse(error.message, 'VALIDATION_ERROR', 400);
      return;
    }

    // Unexpected errors
    ctx.status = 500;
    ctx.body = errorResponse('An unexpected error occurred', 'INTERNAL_ERROR', 500);
  }
}
```

---

## Controller Pattern

### Standard Controller Structure

```javascript
/**
 * Get resource by ID
 * @param {Object} ctx - Koa context
 */
export async function getOne(ctx) {
  try {
    const {shop} = ctx.state;
    const {id} = ctx.params;

    // 1. Fetch data (shop-scoped for security)
    const resource = await repository.getById(shop.id, id);

    // 2. Handle not found
    if (!resource) {
      ctx.status = 404;
      ctx.body = errorResponse('Resource not found', 'NOT_FOUND', 404);
      return;
    }

    // 3. Transform/pick response fields
    const responseData = prepareResponseData(resource);

    // 4. Return success response
    ctx.body = itemResponse(responseData);

  } catch (error) {
    console.error('Error fetching resource:', error);
    ctx.status = 500;
    ctx.body = errorResponse('Failed to fetch resource', 'INTERNAL_ERROR', 500);
  }
}

/**
 * Update resource
 * @param {Object} ctx - Koa context
 */
export async function updateOne(ctx) {
  try {
    const {shop} = ctx.state;
    const {id} = ctx.params;
    const updateData = ctx.request.body;

    // 1. Check existence
    const existing = await repository.getById(shop.id, id);
    if (!existing) {
      ctx.status = 404;
      ctx.body = errorResponse('Resource not found', 'NOT_FOUND', 404);
      return;
    }

    // 2. Perform update
    const updated = await repository.update(shop.id, id, updateData);

    // 3. Return updated resource
    ctx.body = itemResponse(prepareResponseData(updated));

  } catch (error) {
    console.error('Error updating resource:', error);
    ctx.status = 500;
    ctx.body = errorResponse('Failed to update resource', 'INTERNAL_ERROR', 500);
  }
}
```

---

## Field Selection & Transformation

### Pick Response Fields

```javascript
import {pick} from '@avada/utils/lib/pick';

// Define allowed response fields
const publicFields = [
  'id',
  'email',
  'firstName',
  'lastName',
  'points',
  'tierName',
  'createdAt',
  'updatedAt'
];

function prepareResponseData(resource) {
  // Pick only allowed fields
  const picked = pick(resource, publicFields);

  // Transform/format as needed
  return {
    ...picked,
    points: Number(picked.points) || 0,
    createdAt: picked.createdAt?.toISOString?.() || picked.createdAt
  };
}
```

### Never Expose Internal Fields

```javascript
// ❌ BAD: Exposing internal fields
ctx.body = resource;  // May include internal IDs, tokens, etc.

// ✅ GOOD: Pick only public fields
ctx.body = itemResponse(pick(resource, publicFields));
```

---

## Idempotency

### Idempotent Operations

```javascript
router.post('/transactions', async (ctx) => {
  const idempotencyKey = ctx.get('X-Idempotency-Key');

  if (idempotencyKey) {
    // Check for existing transaction with this key
    const existing = await transactionRepository.getByIdempotencyKey(
      ctx.state.shop.id,
      idempotencyKey
    );

    if (existing) {
      ctx.body = itemResponse(existing);
      return;
    }
  }

  // Create new transaction
  const transaction = await transactionRepository.create({
    ...ctx.request.body,
    shopId: ctx.state.shop.id,
    idempotencyKey
  });

  ctx.status = 201;
  ctx.body = itemResponse(transaction);
});
```

---

## API Checklist

### Before Each Endpoint

```
□ Uses standard response format (successResponse/errorResponse)
□ Correct HTTP status codes
□ Input validation with schema
□ Shop-scoped database queries (security)
□ Error handling with try-catch
□ Response fields picked (no internal data exposed)
□ JSDoc comments for documentation
```

### Route Design

```
□ RESTful naming (nouns, not verbs)
□ Consistent versioning (/api/v2)
□ Logical resource grouping
□ Authentication middleware applied
□ Rate limiting configured
```

### Security

```
□ Authentication required for all non-public endpoints
□ Authorization checked (plan access, resource ownership)
□ Rate limiting enabled
□ Input sanitized and validated
□ No sensitive data in responses
□ CORS properly configured
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Inconsistent response format | Use response helpers everywhere |
| Wrong status codes (200 for errors) | Match status to error type |
| No input validation | Add Yup schema validation |
| Exposing internal fields | Pick only public fields |
| Not shop-scoping queries | Always include shopId in queries |
| Ignoring rate limits | Apply rate limiting middleware |
| No error codes | Use consistent ErrorCodes enum |
| Offset pagination at scale | Use cursor-based pagination |