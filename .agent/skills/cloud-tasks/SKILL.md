---
name: cloud-tasks-queue
description: Use this skill when the user asks about "Cloud Tasks", "background jobs", "delayed processing", "rate limit handling", "async queue", "enqueue task", or any task queue work. Provides Cloud Tasks patterns for background processing with automatic retries and rate limiting.
---

# Google Cloud Tasks Patterns

## Overview

Cloud Tasks provides reliable, asynchronous task execution with automatic retries, rate limiting, and scheduled delays.

**Cost:** ~$0.40 per million operations (95% cheaper than Firestore queues)

---

## Basic Usage

```javascript
import {enqueueTask} from '../services/cloudTaskService';

// Immediate task
await enqueueTask({
  functionName: 'enqueueSubscriber',
  data: {
    type: 'triggerOrder',
    data: {shopId, orderId, customerId}
  }
});

// With delay (common for webhooks)
await enqueueTask({
  functionName: 'enqueueSubscriber',
  opts: {scheduleDelaySeconds: 3},
  data: {
    type: 'detectSyncTier',
    data: {shop, customer}
  }
});
```

---

## Rate Limit Handling

```javascript
case 'klaviyoSync': {
  const {shopId, customerId, profileData, retryCount = 0} = data;

  const result = await klaviyoService.createOrUpdateProfile(profileData);

  if (result.success === false && result.retryAfter) {
    await enqueueTask({
      functionName: 'enqueueSubscriber',
      data: {
        type: 'klaviyoSync',
        data: {shopId, customerId, profileData, retryCount: retryCount + 1}
      },
      opts: {scheduleDelaySeconds: Math.ceil(result.retryAfter)}
    });
    return; // Don't throw - prevents Cloud Tasks auto-retry
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
| Rate limit retry | varies | Use `retry-after` header |

---

## Error Handling

| Error Type | Action |
|------------|--------|
| Permanent (no integration) | Return early, don't throw |
| Retriable (network timeout) | Throw for auto retry |
| Rate limit | Re-enqueue with delay |

---

## Checklist

```
□ Use enqueueTask() from cloudTaskService
□ Include task type in data payload
□ Add retry count for rate-limited operations
□ Return early for permanent failures
□ Re-enqueue with delay for rate limits
□ Set max retry count to prevent infinite loops
```