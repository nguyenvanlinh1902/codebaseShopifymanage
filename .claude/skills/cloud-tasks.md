# Google Cloud Tasks Patterns

## Overview

Cloud Tasks provides reliable, asynchronous task execution with automatic retries, rate limiting, and scheduled delays. Used for background processing, webhook handling, and third-party API integrations.

**Cost:** ~$0.40 per million operations (95% cheaper than Firestore queues)

---

## Architecture Pattern

### Centralized Dispatcher

Joy uses a single Cloud Tasks function as a central dispatcher for all task types:

```javascript
// index.js - Single entry point for all tasks
export const enqueueSubscriber = functions
  .runWith({memory: '4GB'})
  .tasks.taskQueue()
  .onDispatch(enqueueHandler);

// enqueueHandler.js - Routes by task type
export default async function enqueueHandler(queueData) {
  const {type, data} = queueData;

  switch (type) {
    case 'klaviyoSync':
      // Handle Klaviyo sync
      break;
    case 'triggerOrder':
      // Handle order processing
      break;
    case 'detectSyncTier':
      // Handle tier detection
      break;
    // ... other task types
  }
}
```

---

## Core Service

**File:** `packages/functions/src/services/cloudTaskService.js`

```javascript
import {getFunctions} from 'firebase-admin/functions';
import {appConfig} from '../config';

const ENQUEUE_SUBSCRIBER_FUNC_NAME = 'enqueueSubscriber';

// Cache queue instances for performance
const queueCache = new Map();

const getTaskQueue = functionName => {
  if (!queueCache.has(functionName)) {
    queueCache.set(functionName, getFunctions().taskQueue(functionName));
  }
  return queueCache.get(functionName);
};

export async function enqueueTask({
  functionName = ENQUEUE_SUBSCRIBER_FUNC_NAME,
  opts = {},
  data = {}
}) {
  // Local emulator support
  if (appConfig.isLocal) {
    if (opts.scheduleDelaySeconds) {
      await delay(opts.scheduleDelaySeconds * 1000);
    }
    return fetch(
      `http://localhost:5011/${process.env.GCLOUD_PROJECT}/us-central1/${functionName}`,
      {
        headers: {'Content-Type': 'application/json'},
        method: 'POST',
        body: JSON.stringify({data})
      }
    );
  }

  // Production: use Cloud Tasks
  const queue = getTaskQueue(functionName);
  await queue.enqueue(data, opts);
}
```

---

## Usage Patterns

### Basic Task Enqueue

```javascript
import {enqueueTask} from '../services/cloudTaskService';
import {ENQUEUE_SUBSCRIBER_FUNC_NAME} from '../handlers/schedule/enqueueHandler';

// Enqueue immediate task
await enqueueTask({
  functionName: ENQUEUE_SUBSCRIBER_FUNC_NAME,
  data: {
    type: 'triggerOrder',
    data: {shopId, orderId, customerId}
  }
});
```

### With Delay (Common for Webhooks)

```javascript
// Delay 3 seconds to handle race conditions
await enqueueTask({
  functionName: ENQUEUE_SUBSCRIBER_FUNC_NAME,
  opts: {scheduleDelaySeconds: 3},
  data: {
    type: 'detectSyncTier',
    data: {shop, customer}
  }
});
```

### Helper Function Pattern

```javascript
// helpers/klaviyoTaskQueue.js
export async function enqueueKlaviyoSync(shopId, customerId, profileData, delaySeconds = 0) {
  await enqueueTask({
    functionName: ENQUEUE_SUBSCRIBER_FUNC_NAME,
    data: {
      type: 'klaviyoSync',
      data: {shopId, customerId, profileData, retryCount: 0}
    },
    opts: {scheduleDelaySeconds: delaySeconds}
  });
}

// Bulk enqueue with Promise.all
export async function enqueueBulkKlaviyoSync(shopId, syncs, delaySeconds = 0) {
  await Promise.all(
    syncs.map(({customerId, profileData}) =>
      enqueueKlaviyoSync(shopId, customerId, profileData, delaySeconds)
    )
  );
}
```

---

## Rate Limit Handling

### Pattern: Re-enqueue on 429

```javascript
case 'klaviyoSync': {
  const {shopId, customerId, profileData, retryCount = 0} = data;

  const result = await klaviyoService.createOrUpdateProfile(profileData);

  // Handle rate limit - re-enqueue with delay
  if (result.success === false && result.retryAfter) {
    const delaySeconds = Math.ceil(result.retryAfter);
    await enqueueTask({
      functionName: ENQUEUE_SUBSCRIBER_FUNC_NAME,
      data: {
        type: 'klaviyoSync',
        data: {shopId, customerId, profileData, retryCount: retryCount + 1}
      },
      opts: {scheduleDelaySeconds: delaySeconds}
    });
    return; // Don't throw - prevents Cloud Tasks auto-retry
  }

  break;
}
```

### Pattern: Shop-Level Throttling

```javascript
// Pre-flight check before API call
const shop = await shopRepository.getById(shopId);
if (shop.klaviyoThrottledUntil > Date.now()) {
  const retryAfter = Math.ceil((shop.klaviyoThrottledUntil - Date.now()) / 1000);
  return {success: false, retryAfter};
}

// On 429 response - update shop throttle
await shopRepository.update(shopId, {
  klaviyoThrottledUntil: Date.now() + (retryAfter * 1000)
});
```

### Pattern: Shopify API Rate Limit with Retry Header

```javascript
case 'syncPriorOrder': {
  const {shopId, orderId, retryCount = 0} = data;

  try {
    await syncOrder(shopId, orderId);
  } catch (error) {
    // Extract retry-after from Shopify response
    if (error.response?.status === 429 && retryCount < 5) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      await enqueueTask({
        functionName: ENQUEUE_SUBSCRIBER_FUNC_NAME,
        data: {
          type: 'syncPriorOrder',
          data: {shopId, orderId, retryCount: retryCount + 1}
        },
        opts: {scheduleDelaySeconds: retryAfter}
      });
      return;
    }
    throw error; // Let Cloud Tasks handle other errors
  }
  break;
}
```

---

## Common Delay Values

| Use Case | Delay | Reason |
|----------|-------|--------|
| Order webhook processing | 3s | Wait for Shopify data consistency |
| Tier detection | 3s | Allow points to settle |
| Customer segment update | 5s | Wait for customer creation |
| Birthday processing | 5s | Allow data to sync |
| Referral reward approval | 4s | Allow referral creation |
| Recursive processing | 20s | Shopify API quota recovery |
| Rate limit retry | varies | Use `retry-after` header value |

---

## Error Handling Strategy

### Permanent Errors (Return Early - No Retry)

```javascript
case 'klaviyoSync': {
  const integration = await getKlaviyoIntegration(shopId);

  // Don't retry - integration not connected
  if (!integration) {
    console.log('Klaviyo not connected for shop', shopId);
    return;
  }

  // Don't retry - invalid credentials
  if (!integration.apiKey) {
    console.log('Invalid Klaviyo credentials for shop', shopId);
    return;
  }

  // Proceed with sync...
}
```

### Retriable Errors (Throw - Cloud Tasks Retries)

```javascript
try {
  await processTask(data);
} catch (error) {
  // Network timeouts, temp API failures - throw for auto retry
  console.error('Task failed, will retry:', error);
  throw error;
}
```

### Rate Limit Errors (Custom Re-enqueue)

```javascript
if (result.retryAfter) {
  // Re-enqueue with specific delay - don't throw
  await enqueueTask({...});
  return;
}
```

---

## When to Use Cloud Tasks

| Scenario | Use Cloud Tasks? | Alternative |
|----------|-----------------|-------------|
| Webhook background processing | Yes | - |
| Third-party API sync (rate limited) | Yes | - |
| Delayed notifications | Yes | - |
| Simple async operation | Maybe | Firestore trigger |
| High-volume event streaming | No | Pub/Sub |
| Complex workflow orchestration | No | Cloud Workflows |
| Real-time processing | No | Direct call |

---

## Best Practices

### DO:
```javascript
// Cache queue instances
const queueCache = new Map();

// Use helper functions for common tasks
await enqueueKlaviyoSync(shopId, customerId, profileData);

// Batch enqueue with Promise.all
await Promise.all(customers.map(c => enqueueSync(c)));

// Include retry count in task data
data: {shopId, customerId, retryCount: 0}

// Return early for permanent failures (don't throw)
if (!integration) return;

// Use appropriate delays for race conditions
opts: {scheduleDelaySeconds: 3}
```

### DON'T:
```javascript
// Don't wait for task completion in request handler
await enqueueTask({...});
await waitForTaskCompletion(); // BAD - blocks response

// Don't throw for rate limits (causes double retry)
if (result.retryAfter) throw new Error('Rate limited'); // BAD

// Don't hardcode delays for rate limits
opts: {scheduleDelaySeconds: 60} // BAD - use retry-after header

// Don't retry infinitely
if (retryCount > 10) {
  console.error('Max retries exceeded');
  return; // Give up gracefully
}
```

---

## Monitoring & Debugging

### Logs

```javascript
// Always log task type and key identifiers
console.log('Running enqueueHandler', type);
console.log(`Processing ${type} for shop ${shopId}, customer ${customerId}`);

// Log rate limit events
console.log(`Rate limit hit, re-enqueueing with ${delaySeconds}s delay`);

// Log completion
console.log(`Successfully completed ${type} for ${customerId}`);
```

### Cloud Console

- **View queues:** Cloud Tasks > Queues
- **Monitor executions:** Cloud Functions > enqueueSubscriber > Logs
- **Filter by type:** Search for specific task type in logs

### Alerts (Recommended)

- High error rate (>5% failures)
- Long queue depth (>1000 pending tasks)
- Task timeout rate (>1% timeouts)

---

## Checklist

```
□ Use enqueueTask() from cloudTaskService (not direct API)
□ Include task type in data payload
□ Add retry count for rate-limited operations
□ Return early for permanent failures (don't throw)
□ Re-enqueue with delay for rate limits (don't throw)
□ Use retry-after header value when available
□ Set appropriate delays for webhook race conditions
□ Batch enqueue with Promise.all for multiple tasks
□ Log task type and key identifiers
□ Set max retry count to prevent infinite loops
```