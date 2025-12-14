# Shopify Bulk Operations Best Practices

## Overview

Shopify Bulk Operations API allows processing thousands of items in a single async operation, bypassing rate limits entirely. Use for mass updates when regular API calls would exceed limits.

**Rate Limit Context:**
- Regular metafield API: **2 requests/second**, **40 requests/minute**
- Bulk Operations: **No rate limits** - runs server-side on Shopify

---

## When to Use Bulk Operations

| Customer Count | Approach | Why |
|---------------|----------|-----|
| 1-50 | Direct API calls | Fast, no overhead |
| 50-500 | Cloud Tasks with batching | Manageable with delays |
| **500+** | **Bulk Operations API** | Avoids rate limits entirely |
| **1000+** | **Bulk Operations (REQUIRED)** | Only viable approach |

**Use Cases:**
- Tier launch/relaunch (thousands of customers)
- Mass metafield sync (point balance, tier info)
- Bulk customer tag updates
- Mass product metafield updates
- Initial data migration

**NOT Recommended for:**
- Single customer updates (too much overhead)
- Real-time updates (async, takes minutes)
- Small batches (<100 items)

---

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    Bulk Operations Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Collect Data → Storage (JSONL file)                         │
│     └── Buffer in memory, flush periodically                    │
│                                                                  │
│  2. Chunk if Needed (50K lines per bulk operation)              │
│     └── Shopify limits file size to ~20-100MB                   │
│                                                                  │
│  3. Upload to Shopify via Staged Uploads                        │
│     └── stagedUploadsCreate → POST file → bulkOperationRunMutation│
│                                                                  │
│  4. Wait for Completion via Webhook                             │
│     └── BULK_OPERATIONS_FINISH webhook triggers next chunk      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Size Limits & Chunking

**Critical Limits:**

| Limit | Value | Strategy |
|-------|-------|----------|
| Max JSONL file size | ~100MB | Chunk large operations |
| Max lines per chunk | **50,000** | Safe limit for metafields |
| Max metafields per line | 1 | One metafield per JSONL line |

**Always chunk large datasets** - don't try to upload 100K+ lines in one operation.

---

## JSONL Format

Each line must be a valid JSON object with variables for your mutation:

**For metafieldsSet:**
```jsonl
{"metafields":{"key":"points","namespace":"loyalty","ownerId":"gid://shopify/Customer/123","value":"500","type":"number_integer"}}
{"metafields":{"key":"points","namespace":"loyalty","ownerId":"gid://shopify/Customer/456","value":"750","type":"number_integer"}}
```

**For customerUpdate (tags):**
```jsonl
{"input":{"id":"gid://shopify/Customer/123","tags":["vip","gold-tier"]}}
{"input":{"id":"gid://shopify/Customer/456","tags":["member","silver-tier"]}}
```

---

## Complete Flow

### Step 1: Create Staged Upload

```graphql
mutation {
  stagedUploadsCreate(input: [{
    resource: BULK_MUTATION_VARIABLES
    filename: "bulk-update.jsonl"
    mimeType: "text/jsonl"
    httpMethod: POST
  }]) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}
```

### Step 2: Upload JSONL File

Upload to the `url` from staged upload with form-data:

```javascript
const formData = new FormData();

// Add all parameters from stagedTargets.parameters
stagedTarget.parameters.forEach(({name, value}) => {
  formData.append(name, value);
});

// Add the JSONL file
formData.append('file', Buffer.from(jsonlContent), {
  filename: 'bulk-update.jsonl',
  contentType: 'text/jsonl'
});

await fetch(stagedTarget.url, {method: 'POST', body: formData});

// Get the stagedUploadPath from the 'key' parameter
const stagedUploadPath = stagedTarget.parameters.find(p => p.name === 'key').value;
```

### Step 3: Run Bulk Mutation

```graphql
mutation {
  bulkOperationRunMutation(
    mutation: "mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } } }",
    stagedUploadPath: "tmp/your-staged-upload-path"
  ) {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

### Step 4: Handle Completion Webhook

Subscribe to `BULK_OPERATIONS_FINISH` webhook:

```javascript
// When webhook fires, check if more chunks needed
if (hasMoreChunks) {
  // Upload next chunk
  await uploadNextChunk(syncId, nextOffset);
} else {
  // Mark as complete
  await updateStatus('completed');
}
```

---

## Chunking Strategy

For datasets > 50K items, process in chunks:

```javascript
const CHUNK_SIZE = 50000;

async function processBulkUpdate(items) {
  const totalChunks = Math.ceil(items.length / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

    // Prepare JSONL for this chunk
    const jsonl = chunk.map(item => JSON.stringify({
      metafields: {
        key: 'points',
        namespace: 'loyalty',
        ownerId: `gid://shopify/Customer/${item.customerId}`,
        value: String(item.points),
        type: 'number_integer'
      }
    })).join('\n');

    // Upload and run bulk operation
    const result = await runBulkOperation(jsonl);

    // Save state for webhook continuation
    await saveChunkState({
      bulkOperationId: result.id,
      currentChunk: i,
      totalChunks,
      nextOffset: (i + 1) * CHUNK_SIZE
    });

    // Wait for webhook before next chunk
    // (don't continue in loop - let webhook trigger next)
    break;
  }
}
```

---

## Data Collection Pattern

For very large datasets, collect recursively across function invocations:

```javascript
async function collectData({after, syncId, count = 0}) {
  const BATCH_SIZE = 2500;
  const BATCHES_PER_CALL = 4; // 10K items per function call

  // Initialize on first call
  if (!syncId) {
    syncId = `sync_${Date.now()}`;
  }

  // Collect multiple batches
  let cursor = after;
  const collected = [];

  for (let i = 0; i < BATCHES_PER_CALL; i++) {
    const {items, pageInfo} = await fetchBatch(cursor, BATCH_SIZE);
    collected.push(...items);
    cursor = items[items.length - 1]?.id;

    if (!pageInfo.hasNext) break;
  }

  // Append to storage (buffered)
  await appendToFile(syncId, prepareJSONL(collected));

  // If more data, schedule next collection
  if (pageInfo.hasNext) {
    await scheduleNextCollection({after: cursor, syncId, count: count + collected.length});
    return;
  }

  // All collected - start bulk upload
  await flushBuffer(syncId);
  await startBulkUpload(syncId);
}
```

---

## Storage Buffering

Buffer writes to avoid storage rate limits:

```javascript
const buffers = new Map();
const FLUSH_THRESHOLD = 5; // batches
const FLUSH_INTERVAL = 30000; // 30 seconds

async function appendToFile(syncId, content) {
  if (!buffers.has(syncId)) {
    buffers.set(syncId, {content: [], count: 0, lastFlush: Date.now()});
  }

  const buffer = buffers.get(syncId);
  buffer.content.push(content);
  buffer.count++;

  const shouldFlush =
    buffer.count >= FLUSH_THRESHOLD ||
    (Date.now() - buffer.lastFlush) > FLUSH_INTERVAL;

  if (shouldFlush) {
    await flushBuffer(syncId);
  }
}

async function flushBuffer(syncId) {
  const buffer = buffers.get(syncId);
  if (!buffer?.content.length) return;

  const content = buffer.content.join('\n');
  buffer.content = [];
  buffer.count = 0;
  buffer.lastFlush = Date.now();

  // Append to storage file
  await storage.appendToFile(`bulk/${syncId}.jsonl`, content);
}
```

---

## Error Handling & Retry

```javascript
async function uploadWithRetry(stagedTarget, jsonl, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await uploadJSONL(stagedTarget, jsonl);
      return; // Success
    } catch (error) {
      const isRetryable = [400, 429, 500, 502, 503, 504].includes(error.status);

      if (isRetryable && attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        await delay(backoffMs);
        continue;
      }

      throw error;
    }
  }
}
```

---

## Best Practices

### DO:

- Use bulk operations for 500+ items
- Chunk at 50K lines per operation
- Buffer writes to storage
- Track progress state for webhook continuation
- Use exponential backoff for retries
- Clean up storage files after completion

### DON'T:

- Use bulk operations for small batches (<100 items)
- Upload huge files without chunking (>100MB)
- Forget to handle `BULK_OPERATIONS_FINISH` webhook
- Write to storage on every iteration (buffer instead)
- Block waiting for bulk operation completion (use webhooks)

---

## Decision Guide

```
How many items to update?
├── 1-50: Direct API calls
├── 50-500: Cloud Tasks with batched API calls
└── 500+: Shopify Bulk Operations API ← THIS SKILL

Is it time-sensitive?
├── Yes (real-time): Cloud Tasks with batching
└── No (can wait minutes): Bulk Operations

Triggered by?
├── User action (sync button): Bulk Operations
├── Webhook (order): Cloud Tasks
└── Cron job (scheduled sync): Bulk Operations
```

---

## Checklist

```
□ Volume > 500 items? → Use Bulk Operations
□ JSONL files chunked at 50K lines max
□ Staged uploads used (stagedUploadsCreate → POST → bulkOperationRunMutation)
□ Storage buffering for large data collection
□ Chunk state saved for webhook continuation
□ BULK_OPERATIONS_FINISH webhook handler implemented
□ Retry logic with exponential backoff
□ Progress status saved for user visibility
□ Cleanup: delete temp files after completion
```

---

## Related Skills

- `.claude/skills/cloud-tasks.md` - For smaller batches with rate limit handling
- `.claude/skills/shopify-api.md` - When to use bulk vs regular API