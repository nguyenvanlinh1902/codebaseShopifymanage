# Firestore Best Practices

## Query Optimization

### Filters & Limits
```javascript
// ❌ BAD: Fetch all, filter in JS
const all = await customersRef.get();
const active = all.docs.filter(d => d.data().status === 'active');

// ✅ GOOD: Filter in query
const active = await customersRef
  .where('status', '==', 'active')
  .where('shopId', '==', shopId)  // Always scope by shop
  .limit(100)                      // Always limit
  .get();
```

### Batch Reads (avoid N+1)
```javascript
// ❌ BAD: Read in loop (N reads)
for (const id of customerIds) {
  const doc = await customerRef.doc(id).get();
}

// ✅ GOOD: Batch read (1 operation)
const docs = await firestore.getAll(
  ...customerIds.map(id => customerRef.doc(id))
);
```

### Select Only Needed Fields
```javascript
// ❌ BAD: Fetch all fields
const docs = await customersRef.get();

// ✅ GOOD: Select specific fields
const docs = await customersRef
  .select('name', 'email', 'tier')
  .get();
```

### Atomic Counters
```javascript
// ❌ BAD: Read-modify-write
const doc = await counterRef.get();
await counterRef.set({ count: doc.data().count + 1 });

// ✅ GOOD: Atomic increment
await counterRef.update({
  count: FieldValue.increment(1)
});
```

### Check Empty Collections
```javascript
// ❌ BAD: Uses .size (counts all docs)
if (snapshot.size === 0) { }

// ✅ GOOD: Uses .empty (fast)
if (snapshot.empty) { }
```

---

## Batch Operations

### Batch Writes (max 500)
```javascript
const batch = firestore.batch();
const BATCH_SIZE = 500;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const chunk = items.slice(i, i + BATCH_SIZE);

  chunk.forEach(item => {
    const ref = collectionRef.doc(item.id);
    batch.set(ref, item);
  });

  await batch.commit();
}
```

### Bulk Delete
```javascript
async function deleteCollection(collectionRef, batchSize = 500) {
  const snapshot = await collectionRef.limit(batchSize).get();

  if (snapshot.empty) return;

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Recurse for remaining docs
  await deleteCollection(collectionRef, batchSize);
}
```

---

## Pagination

### Cursor-based Pagination
```javascript
async function getPage(shopId, lastDoc = null, pageSize = 50) {
  let query = customersRef
    .where('shopId', '==', shopId)
    .orderBy('createdAt', 'desc')
    .limit(pageSize);

  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];

  return {
    data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
    cursor: lastVisible
  };
}
```

---

## Indexes

### When Index Required
| Query Pattern | Index Needed? |
|---------------|---------------|
| Single field `where()` | NO (auto-indexed) |
| `where()` + `orderBy()` different fields | YES |
| Multiple `where()` with inequality | YES |
| `where()` same field as `orderBy()` | NO |

### Create Index
```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "customers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "shopId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

```bash
firebase deploy --only firestore:indexes
```

---

## TTL Policy

### Collections Needing TTL
| Collection | TTL Duration |
|------------|--------------|
| apiLogs | 30-90 days |
| notificationLogs | 30-60 days |
| webhookLogs | 14-30 days |
| syncLogs | 7-30 days |
| errorLogs | 30-90 days |
| tempData / cache | 1-7 days |

### Implementation

**Step 1: Add expiredAt field when creating documents**
```javascript
await logsRef.add({
  ...logData,
  expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});
```

**Step 2: Configure TTL in firestore.indexes.json using fieldOverrides**
```json
{
  "indexes": [],
  "fieldOverrides": [
    {
      "collectionGroup": "webhookLogs",
      "fieldPath": "expiredAt",
      "ttl": true,
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
      ]
    }
  ]
}
```

**Step 3: Deploy**
```bash
firebase deploy --only firestore:indexes
```

---

## Write Rate Limits

**Firestore limit: 1 write per document per second**

Exceeding this causes write timeouts, wasted function invocations, and CPU time.

### When to Use Distributed Writes

| Scenario | Risk | Solution |
|----------|------|----------|
| Frequent shop settings updates | 🔴 High | Distributed collection |
| High-traffic counters | 🔴 High | Distributed counters |
| Real-time status updates | 🔴 High | Separate status collection |
| User activity tracking | 🟡 Medium | Batch writes |

### Pattern: Distributed Collection + Latest Read

```javascript
// ❌ BAD: Multiple writes to same document (will timeout)
await shopRef.doc(shopId).update({ lastSyncAt: new Date() });
// If called 10x/second, 9 will fail

// ✅ GOOD: Write to separate collection, read latest
const shopUpdatesRef = firestore.collection('shopUpdates');

// Write (always succeeds - new document each time)
await shopUpdatesRef.add({
  shopId,
  lastSyncAt: new Date(),
  createdAt: new Date()
});

// Read latest
const latest = await shopUpdatesRef
  .where('shopId', '==', shopId)
  .orderBy('createdAt', 'desc')
  .limit(1)
  .get();

const lastSyncAt = latest.docs[0]?.data().lastSyncAt;
```

### Pattern: Distributed Counters

```javascript
// ❌ BAD: Single counter document (1 write/sec limit)
await counterRef.update({ count: FieldValue.increment(1) });

// ✅ GOOD: Distributed across shards
const NUM_SHARDS = 10;

// Write to random shard
const shardId = Math.floor(Math.random() * NUM_SHARDS);
await counterRef.doc(`shard_${shardId}`).update({
  count: FieldValue.increment(1)
});

// Read: sum all shards
const shards = await counterRef.get();
const total = shards.docs.reduce((sum, doc) => sum + doc.data().count, 0);
```

### Cleanup Old Updates

Add TTL to distributed collections to prevent unbounded growth:

```javascript
await shopUpdatesRef.add({
  shopId,
  lastSyncAt: new Date(),
  createdAt: new Date(),
  expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
});
```

---

## Repository Pattern

**ONE repository = ONE collection (NEVER mix)**

```javascript
// ✅ GOOD: Single collection per repo
// customerRepository.js
const customersRef = firestore.collection('customers');

export const getByShop = (shopId) =>
  customersRef.where('shopId', '==', shopId).get();

export const getById = (id) =>
  customersRef.doc(id).get();

export const create = (data) =>
  customersRef.add({ ...data, createdAt: new Date() });

export const update = (id, data) =>
  customersRef.doc(id).update({ ...data, updatedAt: new Date() });
```