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

### Index File Structure

Index definitions are split by collection in `firestore-indexes/`:

```
firestore-indexes/
├── build.js              # Merges all files into firestore.indexes.json
├── split.js              # Splits firestore.indexes.json into collection files
├── customerRewards.json  # Indexes & overrides for customerRewards
├── customers.json        # Indexes for customers
├── settings.json         # Overrides for settings
└── ... (34 collection files)
```

**Commands:**
| Command | Description |
|---------|-------------|
| `yarn firestore:build` | Merge all collection files into `firestore.indexes.json` |
| `yarn firestore:split` | Split `firestore.indexes.json` into collection files |

### When Index Required
| Query Pattern | Index Needed? |
|---------------|---------------|
| Single field `where()` | NO (auto-indexed) |
| `where()` + `orderBy()` different fields | YES |
| Multiple `where()` with inequality | YES |
| `where()` same field as `orderBy()` | NO |

### Create Index
```json
// firestore-indexes/{collection}.json
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
yarn firestore:build && firebase deploy --only firestore:indexes
```

---

## Index Merging (Optimization)

Firestore can merge indexes at query time for **equality clauses** that share the same sort field. This reduces the total number of indexes needed.

### Concept

**Without merging (4 indexes):**
| Collection | Fields Indexed |
|------------|----------------|
| restaurants | category ASC, star_rating ASC |
| restaurants | city ASC, star_rating ASC |
| restaurants | category ASC, city ASC, star_rating ASC |
| restaurants | category ASC, city ASC, editors_pick ASC, star_rating ASC |

**With merging (3 indexes):**
| Collection | Fields Indexed |
|------------|----------------|
| restaurants | category ASC, star_rating ASC |
| restaurants | city ASC, star_rating ASC |
| restaurants | editors_pick ASC, star_rating ASC |

The merged set supports all the same queries AND additionally supports new query combinations.

### Merge Requirements

For index merging to work:
- All equality fields must be covered across the merged indexes
- Both indexes must have the **same sort field** in the **same direction**
- The sort field must be at the end of each index

### Merge Limitations

Index merging does NOT work for:
- Range queries (`<`, `>`, `<=`, `>=`)
- Array-contains queries
- Different sort directions

### Identifying Mergeable Indexes

Look for indexes with:
1. Multiple equality fields (`where('field', '==', value)`)
2. Same `orderBy()` field at the end
3. Existing simpler indexes covering subsets of the equality fields

```javascript
// This query can use merged indexes:
.where('shopId', '==', shopId)    // equality
.where('tierId', '==', tierId)    // equality
.where('type', '==', 'member')    // equality
.orderBy('updatedAt', 'desc')     // sort field

// Instead of: (shopId, tierId, type, updatedAt DESC)
// Use merged: (shopId, tierId, updatedAt DESC) + (shopId, type, updatedAt DESC)
```

### Testing Index Merging

Before removing an index:
1. Search codebase for queries using that exact field combination
2. Verify the merged indexes exist and have matching sort directions
3. Test in Firebase emulator first
4. Deploy to staging and verify no query failures

```javascript
// Test query to verify index merging works
const testQuery = async (db, shopId) => {
  try {
    const snapshot = await db.collection('customers')
      .where('shopId', '==', shopId)
      .where('tierId', '==', 'tier-123')
      .where('type', '==', 'member')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();
    console.log('Query succeeded with merged indexes');
  } catch (error) {
    console.error('Query failed - index merge not working:', error.message);
  }
};
```

### Documentation Reference

See `docs/firestore-index-merging.md` for detailed list of redundant indexes that can be removed via merging.

---

## Index Exemptions

An index exemption overrides the database-wide automatic index settings for specific fields.

### When to Use Exemptions

| Scenario | Reason |
|----------|--------|
| Large string fields | Reduce storage costs for fields you don't query |
| High write rate with sequential values | Bypass 500 writes/second limit (e.g., timestamps) |
| TTL fields | Reduce performance impact at higher traffic rates |
| Large array/map fields | Avoid 40,000 index entries per document limit |

### Configure Exemptions

```json
// firestore-indexes/{collection}.json
{
  "indexes": [],
  "fieldOverrides": [
    {
      "collectionGroup": "webhookLogs",
      "fieldPath": "body",
      "indexes": []  // Empty array = no indexing
    }
  ]
}
```

### Exemption Scope Options

| Scope | Example | Use Case |
|-------|---------|----------|
| Field-level | `"fieldPath": "requestBody"` | Exempt specific field in collection |
| Collection-wide | `"collectionGroup": "*"` | Exempt field across all collections |
| Map subfields | `"fieldPath": "metadata.raw"` | Exempt nested fields |

### Key Notes

- **Inheritance**: Map field exemptions apply to all subfields unless overridden
- **Composite indexes**: Exempted fields can still be part of composite indexes
- **Limits**: Up to 200 field exemptions per database (1000 with billing enabled)
- **TTL fields**: Should typically be exempted to reduce write overhead

### Commonly Exempted Fields

| Collection | Field | Reason |
|------------|-------|--------|
| customerRewards | `program` | Large nested object, only `program.appliedTo` is queried |
| emailNotificationLogs | `notificationContent` | Full email HTML content |
| webhookLogs | `body` | Full webhook payload JSON |
| settings | `positionMenu`, `pointCalculator` | Complex nested config objects |
| programCache | `data` | Large array of program objects |
| customerActivities | `program`, `order`, `metadata` | Nested data objects |

### Documentation Reference

See `docs/firestore-index-exemptions.md` for complete list of exempted fields by collection.

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