---
name: redis-cache-patterns
description: Use this skill when the user asks about "Redis", "caching", "cache invalidation", "TTL", "circuit breaker", "fire-and-forget", "connection pooling", or any Redis caching work. Provides Redis caching patterns with resilience and cost optimization.
---

# Redis Caching Best Practices

## Overview

Redis caching reduces Firestore reads and improves response latency. However, Redis introduces concerns around **max connections**, **network egress costs**, and **failure handling**.

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
  if (client?.isOpen) {
    return client;
  }

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

---

## Circuit Breaker Pattern

Temporarily disable Redis on repeated failures:

```javascript
let isDisabled = false;
let disabledUntil = 0;
const DISABLE_DURATION_MS = 60000; // 1 minute

function isRedisDisabled() {
  if (!isDisabled) return false;

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
```

---

## Timeout Handling

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
// GOOD: Non-blocking write
function setCache(key, value) {
  getRedisClient()
    .then(client => {
      if (!client?.isOpen) return;
      return client.set(key, JSON.stringify(value));
    })
    .catch(() => {}); // Silently ignore failures
}

// BAD: Blocking write
async function setCache(key, value) {
  const client = await getRedisClient();
  await client.set(key, JSON.stringify(value)); // Blocks response!
}
```

---

## Cache-Aside Pattern (Read-Through)

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

---

## TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Configuration (shop settings) | No expiry | Manual invalidation on update |
| Notification templates | 30 days | Rarely changes |
| Session/token data | 1-24 hours | Security, auto-cleanup |
| Rate limit counters | 1 minute | Auto-reset |
| Temporary/computed data | 5-60 minutes | Balance freshness vs cost |

---

## Cache Invalidation

### On Update

```javascript
async function updateEntity(entityId, updateData) {
  // 1. Update Firestore
  await firestoreUpdate(entityId, updateData);

  // 2. Invalidate cache (next read will re-cache)
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
```

---

## Checklist

```
- Singleton connection with lazy initialization
- Circuit breaker for max connections / failures
- Connection timeout: 500ms
- Read timeout: 300ms
- Fire-and-forget writes (non-blocking)
- Graceful fallback to Firestore on any error
- Cache invalidation on entity updates
- TTL set for temporary data
- Key naming convention established
```