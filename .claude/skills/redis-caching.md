# Redis Caching Best Practices

## Overview

Redis caching reduces Firestore reads and improves response latency. However, Redis introduces concerns around **max connections**, **network egress costs**, and **failure handling**. This skill covers patterns for resilient, cost-effective caching.

**Key Principles:**
- **Fail fast, fail safe** - Never block requests due to Redis issues
- **Fire-and-forget writes** - Cache writes should not slow down responses
- **Circuit breaker** - Temporarily disable Redis on connection issues
- **Graceful degradation** - Always fall back to Firestore

---

## Connection Management

### Singleton Pattern with Lazy Connection

```javascript
let client = null;
let connectionPromise = null;

async function getRedisClient() {
  // Return existing connection if open
  if (client?.isOpen) {
    return client;
  }

  // Avoid multiple simultaneous connection attempts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      client = createClient({
        username: config.username,
        password: config.password,
        socket: {
          host: config.host,
          port: config.port,
          connectTimeout: 500, // Fast fail
          reconnectStrategy: false // Circuit breaker handles reconnection
        }
      });

      client.on('error', handleConnectionError);
      await client.connect();
      return client;
    } catch (e) {
      connectionPromise = null;
      client = null;
      return null;
    }
  })();

  return connectionPromise;
}
```

### Max Connections Handling

Redis Cloud typically limits connections (e.g., 30-100 depending on plan). Handle this gracefully:

```javascript
client.on('error', err => {
  if (err.message.includes('max number of clients')) {
    disableRedis(); // Circuit breaker
  }
});
```

---

## Circuit Breaker Pattern

Temporarily disable Redis on repeated failures to prevent connection storms:

```javascript
let isDisabled = false;
let disabledUntil = 0;
const DISABLE_DURATION_MS = 60000; // 1 minute

function isRedisDisabled() {
  if (!isDisabled) return false;

  // Auto-recovery after timeout
  if (Date.now() > disabledUntil) {
    isDisabled = false;
    return false;
  }
  return true;
}

function disableRedis() {
  isDisabled = true;
  disabledUntil = Date.now() + DISABLE_DURATION_MS;
  console.log('Redis disabled for 60s due to connection issues');
}

// Use in client getter
async function getRedisClient() {
  if (isRedisDisabled()) {
    return null; // Skip Redis entirely
  }
  // ... connection logic
}
```

**When circuit breaker trips:**
- Max connections reached
- Connection timeout
- Repeated connection failures

**Auto-recovery:**
- After disable duration expires, next request attempts reconnection
- Successful reconnection resets circuit breaker

---

## Timeout Handling

Different timeouts for different operations:

| Operation | Timeout | Why |
|-----------|---------|-----|
| Connection | 500ms | Fail fast if Redis unreachable |
| Cache Read | 300ms | Quick fallback to Firestore |
| Cache Write | None | Fire-and-forget, non-blocking |

### Timeout Wrapper

```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Redis timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage
async function getCache(key) {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await withTimeout(client.get(key), 300);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    return null; // Fail silently, fall back to DB
  }
}
```

---

## Fire-and-Forget Writes

Cache writes should **never** block the response:

```javascript
// ✅ GOOD: Non-blocking write
function setCache(key, value) {
  getRedisClient()
    .then(client => {
      if (!client?.isOpen) return;
      return client.set(key, JSON.stringify(value));
    })
    .catch(() => {}); // Silently ignore failures
}

// ❌ BAD: Blocking write
async function setCache(key, value) {
  const client = await getRedisClient();
  await client.set(key, JSON.stringify(value)); // Blocks response!
}
```

**Why fire-and-forget:**
- Cache is optimization, not critical path
- If write fails, next read will cache from Firestore
- Response latency unaffected by Redis issues

---

## Cache-Aside Pattern (Read-Through)

Standard pattern for caching Firestore data:

```javascript
async function getEntityCached(entityId) {
  const cacheKey = `entity:${entityId}`;

  // 1. Try cache first (fast timeout)
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. Cache miss - fetch from Firestore
  const entity = await getEntityFromFirestore(entityId);

  // 3. Cache for next time (fire-and-forget)
  if (entity) {
    setCache(cacheKey, entity);
  }

  return entity;
}
```

**Flow:**
```
Request → Try Redis (300ms) → Hit? Return cached
                            ↓
                         Miss/Timeout
                            ↓
                    Fetch from Firestore
                            ↓
                    Cache result (async)
                            ↓
                      Return to client
```

---

## TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Configuration (shop settings) | No expiry | Manual invalidation on update |
| Notification templates | 30 days | Rarely changes, explicit invalidation |
| Session/token data | 1-24 hours | Security, auto-cleanup |
| Rate limit counters | 1 minute | Auto-reset |
| Temporary/computed data | 5-60 minutes | Balance freshness vs cost |

```javascript
function setCacheWithTTL(key, value, ttlSeconds) {
  getRedisClient()
    .then(client => {
      if (!client?.isOpen) return;
      return client.setEx(key, ttlSeconds, JSON.stringify(value));
    })
    .catch(() => {});
}
```

---

## Caching Null Values

Distinguish cache miss from "value is null":

```javascript
const NULL_MARKER = {__null: true};

async function getCachedWithNull(key) {
  const cached = await getCache(key);

  // Cache miss
  if (cached === null) {
    return {hit: false, value: null};
  }

  // Cached null value
  if (cached.__null) {
    return {hit: true, value: null};
  }

  // Cached real value
  return {hit: true, value: cached};
}

function setCacheAllowNull(key, value) {
  const toCache = value === null ? NULL_MARKER : value;
  setCache(key, toCache);
}
```

**Why cache nulls:**
- Prevents repeated Firestore reads for non-existent entities
- Common for "check if exists" queries

---

## Excluding Volatile Fields

Don't cache fields that change frequently (reduces invalidation):

```javascript
const EXCLUDE_FROM_CACHE = [
  'countCustomer',
  'countMember',
  'monthlyOrderCount',
  'lastUpdatedAt'
];

function prepareForCache(entity) {
  const cached = {...entity};
  for (const field of EXCLUDE_FROM_CACHE) {
    delete cached[field];
  }
  return cached;
}

function isVolatileOnlyUpdate(updateData) {
  const fields = Object.keys(updateData);
  return fields.every(f => EXCLUDE_FROM_CACHE.includes(f));
}

// Skip cache update if only counters changed
async function updateEntityCache(entityId, updateData) {
  if (isVolatileOnlyUpdate(updateData)) {
    return; // No need to update cache
  }
  // ... update cache
}
```

---

## Key Naming Conventions

```javascript
// Pattern: {prefix}:{identifier-type}:{value}
const CACHE_KEYS = {
  shopById: (id) => `shop:id:${id}`,
  shopByDomain: (domain) => `shop:domain:${domain}`,
  notification: (shopId, event) => `notification:${shopId}:${event}`,
  rateLimit: (shopId, action) => `ratelimit:${shopId}:${action}`
};
```

**Best practices:**
- Use colons as separators
- Include entity type prefix
- Include identifier type (id, domain, email)
- Keep keys short (network egress cost)

---

## Network Egress Optimization

Redis Cloud charges for network egress. Minimize data transfer:

### 1. Cache Only What You Need

```javascript
// ❌ BAD: Cache entire document with large fields
setCache(key, fullDocument); // May include large JSON blobs

// ✅ GOOD: Cache only frequently-accessed fields
const toCache = {
  id: doc.id,
  name: doc.name,
  settings: doc.settings
  // Exclude: largeJsonBlob, fullHistory, etc.
};
setCache(key, toCache);
```

### 2. Use Short Keys

```javascript
// ❌ BAD: Long verbose keys
'shop:shopify-domain:my-awesome-store.myshopify.com:settings:notifications'

// ✅ GOOD: Compact keys
'sh:d:my-awesome-store:ntf'
```

### 3. Compress Large Values (if needed)

```javascript
import {gzip, gunzip} from 'zlib';
import {promisify} from 'util';

const compress = promisify(gzip);
const decompress = promisify(gunzip);

async function setCacheCompressed(key, value) {
  const json = JSON.stringify(value);
  if (json.length > 1000) { // Only compress if worth it
    const compressed = await compress(json);
    setCache(key, {__compressed: compressed.toString('base64')});
  } else {
    setCache(key, value);
  }
}
```

---

## Cache Invalidation

### On Update

```javascript
async function updateEntity(entityId, updateData) {
  // 1. Update Firestore
  await firestoreUpdate(entityId, updateData);

  // 2. Invalidate or update cache
  if (isVolatileOnlyUpdate(updateData)) {
    return; // Skip cache update
  }

  // Option A: Delete cache (next read will re-cache)
  deleteCache(`entity:${entityId}`);

  // Option B: Update cache in place (if you have full data)
  const cached = await getCache(`entity:${entityId}`);
  if (cached) {
    setCache(`entity:${entityId}`, {...cached, ...updateData});
  }
}
```

### On Delete

```javascript
async function deleteEntity(entityId) {
  await firestoreDelete(entityId);
  deleteCache(`entity:${entityId}`);
}
```

### Bulk Invalidation

```javascript
function invalidateMultiple(keys) {
  if (!keys?.length) return;

  getRedisClient()
    .then(client => {
      if (!client?.isOpen) return;
      return client.del(keys);
    })
    .catch(() => {});
}

// Usage: invalidate all caches for a shop
invalidateMultiple([
  `shop:id:${shopId}`,
  `shop:domain:${domain}`,
  `notification:${shopId}:earn`,
  `notification:${shopId}:redeem`
]);
```

---

## Best Practices Summary

### DO:

- Use circuit breaker to prevent connection storms
- Fail fast with short timeouts (300-500ms)
- Fire-and-forget all writes
- Always fall back to Firestore on cache miss/error
- Cache full documents, filter in application code
- Exclude volatile fields from cache
- Use TTL for data that can go stale
- Cache null values to prevent repeated lookups

### DON'T:

- Block responses waiting for cache writes
- Throw exceptions on cache failures
- Cache data that changes every request
- Use long keys (egress cost)
- Cache sensitive data without TTL
- Assume cache is always available

---

## Checklist

```
□ Singleton connection with lazy initialization
□ Circuit breaker for max connections / failures
□ Connection timeout: 500ms
□ Read timeout: 300ms
□ Fire-and-forget writes (non-blocking)
□ Graceful fallback to Firestore on any error
□ Volatile fields excluded from cache
□ Cache invalidation on entity updates
□ TTL set for temporary data
□ Key naming convention established
□ Null value caching handled
□ Network egress considered (key length, value size)
```

---

## Related Skills

- `.claude/skills/firestore.md` - Firestore query optimization
- `.claude/skills/backend.md` - Async patterns and error handling