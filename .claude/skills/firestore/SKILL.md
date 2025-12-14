---
name: firestore-database
description: Use this skill when the user asks about "Firestore", "database queries", "indexes", "batch operations", "pagination", "TTL", "write limits", or any Firestore-related work. Provides Firestore query optimization, indexing, and best practices.
---

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
  .where('shopId', '==', shopId)
  .limit(100)
  .get();
```

### Batch Reads

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

### Check Empty Collections

```javascript
// ❌ BAD: Uses .size
if (snapshot.size === 0) { }

// ✅ GOOD: Uses .empty (fast)
if (snapshot.empty) { }
```

---

## Batch Operations

```javascript
const batch = firestore.batch();
const BATCH_SIZE = 500;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const chunk = items.slice(i, i + BATCH_SIZE);
  chunk.forEach(item => {
    batch.set(collectionRef.doc(item.id), item);
  });
  await batch.commit();
}
```

---

## Indexes

### Index File Structure

If `firestore-indexes/` folder exists, **always add indexes there** (not directly to `firestore.indexes.json`):

```
firestore-indexes/
├── build.js              # Merge all → firestore.indexes.json
├── split.js              # Split into collection files
├── customers.json        # Indexes for customers
└── {collection}.json     # One file per collection
```

### Workflow

1. Create/edit `firestore-indexes/{collection}.json`
2. Run `yarn firestore:build` to regenerate `firestore.indexes.json`

| Command | Description |
|---------|-------------|
| `yarn firestore:build` | Merge into firestore.indexes.json |
| `yarn firestore:split` | Split into collection files |

### When Index Required

| Query Pattern | Index Needed? |
|---------------|---------------|
| Single field `where()` | NO (auto) |
| `where()` + `orderBy()` different fields | YES |
| Multiple inequality `where()` | YES |

---

## Index Exemptions

Use for large fields you don't query:

```json
{
  "fieldOverrides": [
    {
      "collectionGroup": "webhookLogs",
      "fieldPath": "body",
      "indexes": []
    }
  ]
}
```

---

## Write Rate Limits

**Limit: 1 write per document per second**

```javascript
// ❌ BAD: Multiple writes to same doc
await shopRef.doc(shopId).update({ lastSyncAt: new Date() });

// ✅ GOOD: Write to separate collection
await shopUpdatesRef.add({
  shopId,
  lastSyncAt: new Date(),
  expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});
```

---

## Repository Pattern

**ONE repository = ONE collection**

```javascript
const customersRef = firestore.collection('customers');

export const getByShop = (shopId) =>
  customersRef.where('shopId', '==', shopId).get();

export const update = (id, data) =>
  customersRef.doc(id).update({ ...data, updatedAt: new Date() });
```