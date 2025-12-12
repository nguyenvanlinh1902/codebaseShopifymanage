# Node.js & Firebase Functions Patterns

## Async/Await Patterns

### Parallel Execution with Promise.all

```javascript
// ❌ BAD: Sequential (3000ms)
const customers = await getCustomers();  // 1000ms
const settings = await getSettings();     // 1000ms
const tiers = await getTiers();           // 1000ms

// ✅ GOOD: Parallel (1000ms)
const [customers, settings, tiers] = await Promise.all([
  getCustomers(),
  getSettings(),
  getTiers()
]);
```

### Avoid Await in Loops

```javascript
// ❌ BAD: Sequential loop (N × latency)
for (const customer of customers) {
  await updateCustomer(customer);
}

// ✅ GOOD: Parallel
await Promise.all(customers.map(c => updateCustomer(c)));

// ✅ BETTER: Chunked for rate limits
async function processInChunks(items, fn, chunkSize = 10) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map(fn));
  }
}
```

### Error Handling

```javascript
// Promise.allSettled - when partial failures OK
const results = await Promise.allSettled([
  sendEmail(user1),
  sendEmail(user2),
  sendEmail(user3)
]);

const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');
```

### Retry with Backoff

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
    }
  }
}
```

### Timeout Protection

```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage
const result = await withTimeout(fetchFromAPI(), 5000);
```

---

## Firebase Functions Configuration

### Right-Sizing Guide

| Function Type | Memory | Timeout | Min Instances |
|---------------|--------|---------|---------------|
| Simple API handler | 256MB | 60s | 0 |
| Webhook handler | 256-512MB | 60s | 0-1 |
| Data sync (small) | 512MB | 120s | 0 |
| Data sync (large) | 1GB | 540s | 0 |
| Image processing | 1-2GB | 300s | 0 |
| Bulk operations | 1GB | 540s | 0 |
| High-traffic API | 512MB | 60s | 1-2 |

### Configuration Example

```javascript
exports.api = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 100
  })
  .https.onRequest(app);
```

### Cold Start Optimization

```javascript
// ❌ BAD: Load everything at startup
const sharp = require('sharp');
const bigquery = require('@google-cloud/bigquery');

// ✅ GOOD: Lazy load heavy dependencies
let sharp, bigquery;

async function processImage(buffer) {
  if (!sharp) sharp = require('sharp');
  return sharp(buffer).resize(800).toBuffer();
}

// ✅ GOOD: Reuse connections (global scope)
const firestore = admin.firestore();
```

---

## Webhook Handlers (CRITICAL)

### 5-Second Response Rule

**Shopify requires response within 5 seconds or it will retry.**

```javascript
// ❌ BAD: Heavy processing (may timeout)
app.post('/webhooks/orders/create', async (req, res) => {
  await calculatePoints(req.body);      // Slow!
  await updateCustomer(req.body);        // Slow!
  await syncToShopify(req.body);         // Slow!
  res.status(200).send('OK');
});

// ✅ GOOD: Queue and respond fast
app.post('/webhooks/orders/create', async (req, res) => {
  // 1. Quick validation only
  if (!verifyHmac(req)) {
    return res.status(401).send('Unauthorized');
  }

  // 2. Queue for background (fast write)
  await webhookQueueRef.add({
    type: 'orders/create',
    payload: req.body,
    receivedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 3. Respond immediately
  res.status(200).send('OK');
});

// Background processor (separate function)
exports.processWebhook = functions.firestore
  .document('webhookQueue/{id}')
  .onCreate(async (snap) => {
    const { type, payload } = snap.data();

    if (type === 'orders/create') {
      await calculatePoints(payload);
      await updateCustomer(payload);
    }

    await snap.ref.update({ processedAt: new Date() });
  });
```

### Background Processing Options

| Method | Use Case | Pros | Cons |
|--------|----------|------|------|
| Firestore trigger | Simple queuing | Easy, auto retry | Cold start delay |
| Cloud Tasks | Delayed processing | Schedule delays | More setup |
| Pub/Sub | High volume | Fast, scalable | More complex |

---

## Cron Jobs (Scheduled Functions)

### Efficient Queries

```javascript
// ❌ BAD: Read ALL documents
exports.dailySync = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const all = await customersRef.get(); // All customers!
  });

// ✅ GOOD: Incremental sync
exports.dailySync = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const lastSync = await getLastSyncTimestamp();

    const updated = await customersRef
      .where('updatedAt', '>', lastSync)
      .limit(500)
      .get();

    await Promise.all(updated.docs.map(doc => sync(doc)));
    await setLastSyncTimestamp(new Date());
  });
```

---

## Logging

```javascript
const functions = require('firebase-functions');

// Use appropriate log levels
functions.logger.debug('Debug info', { customerId });
functions.logger.info('Processing order', { orderId, shopId });
functions.logger.warn('Rate limit approaching', { remaining: 10 });
functions.logger.error('Failed to sync', { error: err.message });

// ❌ BAD: Excessive logging
for (const item of items) {
  console.log('Processing:', item); // Don't log every item!
}

// ✅ GOOD: Summary logging
functions.logger.info('Processing batch', { count: items.length });
```

---

## Security

### Input Validation

```javascript
app.post('/api/points/earn', async (req, res) => {
  const { orderId, customerId, amount } = req.body;

  // Validate required fields
  if (!orderId || !customerId) {
    return res.json({ success: false, error: 'Missing required fields' });
  }

  // Validate types
  if (typeof amount !== 'number' || amount < 0) {
    return res.json({ success: false, error: 'Invalid amount' });
  }

  // Validate ownership
  const order = await orderRepo.getById(orderId);
  if (order.shopId !== req.shopId) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  // Process...
});
```

### Environment Variables

```javascript
// ✅ Access secrets from environment
const apiKey = process.env.SHOPIFY_API_KEY;

// ❌ NEVER log secrets
console.log('API Key:', apiKey); // DON'T!
```

---

## Checklist

```
□ Independent async operations use Promise.all
□ No await inside loops (use map + Promise.all)
□ Functions right-sized (memory, timeout)
□ Heavy dependencies lazy-loaded
□ Webhooks respond < 5 seconds
□ Heavy processing in background queue
□ Cron queries scoped (not full table scans)
□ Proper error handling with try/catch
□ Input validation on all endpoints
□ Secrets in environment variables
```