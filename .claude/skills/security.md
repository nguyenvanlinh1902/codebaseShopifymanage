# Security Patterns

## Critical Vulnerabilities to Prevent

| Vulnerability | Risk | Example |
|--------------|------|---------|
| **IDOR** | High | User A accesses User B's data via `/api/customer/123` |
| **Unauthenticated PII** | Critical | Returning customer email in public API response |
| **Missing Auth** | Critical | `/popup/*` endpoints without authentication |
| **Shop Isolation** | Critical | Shop A accessing Shop B's data |

---

## Authentication Patterns

### Endpoint Types & Requirements

| Endpoint Type | Auth Required | Example |
|--------------|---------------|---------|
| Admin API | Shop session + JWT | `/api/admin/*` |
| Storefront API | Customer token OR signature | `/api/storefront/*` |
| Popup/Widget | HMAC signature | `/popup/*` |
| Webhook | Shopify HMAC | `/webhooks/*` |
| Public | None (no sensitive data) | `/health`, `/status` |

### Admin Controller Pattern

```javascript
// ✅ GOOD: Always get shop from authenticated context
import {getCurrentShop, getCurrentShopData} from '@functions/helpers/auth';

async function getCustomers(ctx) {
  const shopId = getCurrentShop(ctx);  // From authenticated session

  // Shop-scoped query - prevents cross-shop access
  const customers = await customerRepo.getByShopId(shopId);

  ctx.body = {success: true, data: customers};
}
```

### Storefront Controller Pattern

```javascript
// ✅ GOOD: Validate customer can only access their own data
async function getCustomerProfile(ctx) {
  const {shopId, customerId} = ctx.params;

  // Verify customer identity from token/signature
  const authenticatedCustomerId = await verifyCustomerToken(ctx);

  // IDOR prevention: ensure customer accesses only their data
  if (customerId !== authenticatedCustomerId) {
    ctx.status = 403;
    ctx.body = {success: false, error: 'Access denied'};
    return;
  }

  const customer = await customerRepo.getById(shopId, customerId);
  ctx.body = {success: true, data: customer};
}
```

---

## IDOR Prevention

### What is IDOR?

Insecure Direct Object Reference - when an attacker manipulates IDs to access other users' data.

### IDOR Audit Methodology

Run this audit on every controller endpoint:

```
For each endpoint:
1. WHERE does shopId/customerId come from?
   - ✅ SECURE: ctx.state.shop.id, getCurrentShop(ctx), authenticated session
   - ❌ VULNERABLE: ctx.params, ctx.query, ctx.request.body

2. IS the query scoped?
   - ✅ SECURE: .where('shopId', '==', shopId)
   - ❌ VULNERABLE: .doc(id).get() without ownership check

3. IS ownership verified before returning data?
   - ✅ SECURE: if (resource.shopId !== shopId) return 403
   - ❌ VULNERABLE: return data directly without check

4. CAN user modify other users' resources?
   - ✅ SECURE: Verify ownership before update/delete
   - ❌ VULNERABLE: repo.update(id, data) without check
```

### Common IDOR Patterns to Search For

```bash
# Find potential IDOR vulnerabilities
grep -rn "ctx.params.shopId" controllers/        # Shop ID from params
grep -rn "ctx.params.customerId" controllers/    # Customer ID from params
grep -rn "ctx.query.shopId" controllers/         # Shop ID from query
grep -rn "getById(" repositories/                # Direct ID lookup
grep -rn ".doc(.*).get()" repositories/          # Firestore direct access
grep -rn "update(.*id" repositories/             # Update by ID only
grep -rn "delete(.*id" repositories/             # Delete by ID only
```

### Endpoint Audit Template

| Endpoint | Method | Auth | Shop Scoped | Customer Scoped | Status |
|----------|--------|------|-------------|-----------------|--------|
| `/api/customers` | GET | ✅ | ✅ | N/A | SECURE |
| `/api/customer/:id` | GET | ✅ | ❌ | ❌ | **IDOR** |
| `/popup/points/:customerId` | GET | ❌ | ❌ | ❌ | **CRITICAL** |

```javascript
// ❌ VULNERABLE: No ownership check
async function getOrder(ctx) {
  const {orderId} = ctx.params;
  const order = await orderRepo.getById(orderId);  // Anyone can access any order!
  ctx.body = order;
}

// ✅ SECURE: Verify ownership
async function getOrder(ctx) {
  const shopId = getCurrentShop(ctx);
  const {orderId} = ctx.params;

  const order = await orderRepo.getById(orderId);

  // Verify order belongs to authenticated shop
  if (order.shopId !== shopId) {
    ctx.status = 403;
    ctx.body = {success: false, error: 'Access denied'};
    return;
  }

  ctx.body = {success: true, data: order};
}
```

### IDOR Checklist

```
□ Shop ID comes from authenticated session, not request params
□ Customer ID verified against authenticated customer token
□ Database queries include shop/customer scope
□ Response data belongs to authenticated entity
□ Nested resources verify parent ownership
```

---

## Protecting Customer PII

### Never Return PII in Public Endpoints

```javascript
// ❌ CRITICAL: Exposing email in unauthenticated endpoint
app.get('/popup/customer/:customerId', async (ctx) => {
  const customer = await customerRepo.getById(ctx.params.customerId);
  ctx.body = {
    name: customer.name,
    email: customer.email,      // PII exposed!
    phone: customer.phone,      // PII exposed!
    address: customer.address   // PII exposed!
  };
});

// ✅ SECURE: Only return non-sensitive data or require auth
app.get('/popup/customer/:customerId', async (ctx) => {
  // Verify request signature
  if (!verifyPopupSignature(ctx)) {
    ctx.status = 401;
    return;
  }

  const customer = await customerRepo.getById(ctx.params.customerId);
  ctx.body = {
    firstName: customer.firstName,  // OK: not unique identifier
    points: customer.points,        // OK: non-PII
    tier: customer.tier            // OK: non-PII
  };
  // Never return: email, phone, full address, payment info
});
```

### PII Classification

| Data Type | Classification | Public Endpoint? |
|-----------|---------------|------------------|
| Email | PII | Never |
| Phone | PII | Never |
| Full Address | PII | Never |
| Date of Birth | PII | Never |
| Payment Info | Sensitive PII | Never |
| First Name | Low Risk | With signature |
| Points Balance | Non-PII | With signature |
| Tier Level | Non-PII | With signature |
| Order Count | Non-PII | With signature |

---

## Popup/Widget Security

### HMAC Signature Verification

```javascript
import crypto from 'crypto';

function verifyPopupSignature(ctx) {
  const {shopId, customerId, timestamp, signature} = ctx.query;

  // Reject old requests (prevent replay attacks)
  const requestAge = Date.now() - parseInt(timestamp);
  if (requestAge > 5 * 60 * 1000) {  // 5 minutes
    return false;
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.POPUP_SECRET)
    .update(`${shopId}:${customerId}:${timestamp}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in middleware
async function popupAuthMiddleware(ctx, next) {
  if (!verifyPopupSignature(ctx)) {
    ctx.status = 401;
    ctx.body = {success: false, error: 'Invalid signature'};
    return;
  }
  await next();
}
```

### Generating Popup URLs (Server-Side)

```javascript
function generatePopupUrl(shopId, customerId) {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', process.env.POPUP_SECRET)
    .update(`${shopId}:${customerId}:${timestamp}`)
    .digest('hex');

  return `/popup/widget?shopId=${shopId}&customerId=${customerId}&timestamp=${timestamp}&signature=${signature}`;
}
```

---

## Webhook Security

### Common Webhook Vulnerabilities

| Pattern | Risk |
|---------|------|
| HMAC bypass headers | CRITICAL: Allows skipping verification |
| No HMAC verification | HIGH: Accepts any request |
| Missing timestamp validation | MEDIUM: Replay attacks possible |
| Non-constant-time comparison | LOW: Timing attacks |

### Shopify Webhook HMAC Verification

```javascript
import crypto from 'crypto';

function verifyShopifyWebhook(ctx) {
  const hmacHeader = ctx.get('X-Shopify-Hmac-Sha256');
  const rawBody = ctx.request.rawBody;

  const calculatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(calculatedHmac)
  );
}

// ✅ GOOD: Always verify before processing
app.post('/webhooks/orders/create', async (ctx) => {
  if (!verifyShopifyWebhook(ctx)) {
    ctx.status = 401;
    return;
  }

  // Safe to process webhook
  await processOrderWebhook(ctx.request.body);
  ctx.status = 200;
});
```

---

## Input Validation

### Validate All Inputs

```javascript
// ❌ VULNERABLE: No validation
async function updateCustomer(ctx) {
  const {customerId} = ctx.params;
  const data = ctx.request.body;
  await customerRepo.update(customerId, data);  // Arbitrary field updates!
}

// ✅ SECURE: Whitelist allowed fields
async function updateCustomer(ctx) {
  const shopId = getCurrentShop(ctx);
  const {customerId} = ctx.params;
  const {firstName, lastName, birthday} = ctx.request.body;

  // Validate and sanitize
  const sanitizedData = {
    firstName: sanitizeString(firstName, 50),
    lastName: sanitizeString(lastName, 50),
    birthday: validateDate(birthday)
  };

  // Verify ownership
  const customer = await customerRepo.getById(customerId);
  if (customer.shopId !== shopId) {
    ctx.status = 403;
    return;
  }

  await customerRepo.update(customerId, sanitizedData);
  ctx.body = {success: true};
}
```

### Sanitization Helpers

```javascript
function sanitizeString(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  return email.toLowerCase().trim();
}

function validateDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date.toISOString();
}
```

---

## Firestore Security

### Shop-Scoped Queries

```javascript
// ❌ VULNERABLE: No shop scope
async function getActivities() {
  return db.collection('activities').get();  // Returns ALL shops' data!
}

// ✅ SECURE: Always scope by shop
async function getActivities(shopId) {
  return db
    .collection('activities')
    .where('shopId', '==', shopId)
    .get();
}
```

### Firestore Rules Pattern

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ❌ VULNERABLE: Public read
    match /customers/{customerId} {
      allow read: if true;  // Anyone can read!
    }

    // ✅ SECURE: Require auth + shop scope
    match /customers/{customerId} {
      allow read, write: if request.auth != null
        && request.auth.token.shopId == resource.data.shopId;
    }
  }
}
```

### Firebase Storage Rules Pattern

```
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // ❌ VULNERABLE: Public access
    match /{allPaths=**} {
      allow read, write: if true;  // Anyone can upload/download!
    }

    // ✅ SECURE: Require auth + path validation
    match /shops/{shopId}/{allPaths=**} {
      allow read: if request.auth != null
        && request.auth.token.shopId == shopId;
      allow write: if request.auth != null
        && request.auth.token.shopId == shopId
        && request.resource.size < 5 * 1024 * 1024;  // 5MB limit
    }
  }
}
```

---

## XSS Prevention

### Escape User Content

```javascript
// ❌ VULNERABLE: Raw HTML injection
function renderReview(review) {
  return `<div>${review.content}</div>`;  // XSS if content has <script>
}

// ✅ SECURE: Escape HTML
import escapeHtml from 'escape-html';

function renderReview(review) {
  return `<div>${escapeHtml(review.content)}</div>`;
}
```

### React Auto-Escaping

```javascript
// ✅ React automatically escapes (safe)
function Review({content}) {
  return <div>{content}</div>;  // Content is escaped
}

// ❌ VULNERABLE: dangerouslySetInnerHTML
function Review({htmlContent}) {
  return <div dangerouslySetInnerHTML={{__html: htmlContent}} />;  // XSS risk!
}
```

---

## Rate Limiting

### Protect Public Endpoints

```javascript
import rateLimit from 'koa-ratelimit';

// Rate limit for popup endpoints
const popupRateLimiter = rateLimit({
  driver: 'memory',
  db: new Map(),
  duration: 60000,  // 1 minute
  max: 30,          // 30 requests per minute
  errorMessage: 'Too many requests',
  id: (ctx) => ctx.ip
});

app.use(popupRateLimiter);
```

---

## Security Checklist

### Before Every PR

```
Authentication:
□ All sensitive endpoints require authentication
□ Shop ID from session, not request params
□ Customer ID verified against token

Authorization:
□ Users can only access their own data
□ Shop isolation verified
□ No IDOR vulnerabilities

Data Protection:
□ No PII in unauthenticated responses
□ Sensitive fields excluded from API responses
□ Input validated and sanitized

Webhooks & Signatures:
□ HMAC verification on all webhooks
□ Popup signatures verified
□ Timestamp validation (prevent replay)

Database:
□ All queries shop-scoped
□ No arbitrary field updates
□ Parameterized queries (no injection)
```

### Common Vulnerable Patterns

| Pattern | Risk | Fix |
|---------|------|-----|
| `ctx.params.shopId` | Shop impersonation | Use `getCurrentShop(ctx)` |
| `repo.getById(id)` | IDOR | Add shop/customer scope |
| Return full customer object | PII leak | Whitelist response fields |
| `/popup/*` without auth | Data exposure | Add signature verification |
| `ctx.request.body` direct use | Mass assignment | Whitelist allowed fields |