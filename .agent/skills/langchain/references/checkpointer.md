# Checkpointer & Memory Persistence

## Table of Contents
- [Checkpointer Overview](#checkpointer-overview)
- [Built-in Checkpointers](#built-in-checkpointers)
- [BaseCheckpointSaver Interface](#basecheckpointsaver-interface)
- [Firestore Checkpointer Implementation](#firestore-checkpointer-implementation)
- [Thread Management](#thread-management)
- [Checkpoint Tuple Structure](#checkpoint-tuple-structure)
- [Usage Patterns](#usage-patterns)
- [Production Considerations](#production-considerations)

---

## Checkpointer Overview

Checkpointers provide persistence for LangGraph state, enabling:

- **Conversation memory** - Continue conversations across sessions
- **Human-in-the-loop** - Pause and resume at interrupt points
- **Multi-tenant isolation** - Separate threads per user/conversation
- **State recovery** - Resume from any checkpoint
- **Audit trails** - History of all state changes

---

## Built-in Checkpointers

| Checkpointer | Package | Use Case |
|--------------|---------|----------|
| `MemorySaver` | `@langchain/langgraph` | Development/testing only |
| `SqliteSaver` | `@langchain/langgraph-checkpoint-sqlite` | Local persistence |
| `PostgresSaver` | `@langchain/langgraph-checkpoint-postgres` | Production |

### MemorySaver (Development Only)

```javascript
import {MemorySaver} from '@langchain/langgraph';

const checkpointer = new MemorySaver();
const app = graph.compile({checkpointer});

// Memory lost when process restarts!
```

### SqliteSaver (Local Persistence)

```javascript
import {SqliteSaver} from '@langchain/langgraph-checkpoint-sqlite';

const checkpointer = SqliteSaver.fromConnString('checkpoints.db');
const app = graph.compile({checkpointer});
```

---

## BaseCheckpointSaver Interface

Custom checkpointers must implement these methods:

| Method | Description |
|--------|-------------|
| `put()` | Save a checkpoint |
| `putWrites()` | Save pending writes (intermediate state) |
| `getTuple()` | Retrieve a checkpoint by config |
| `list()` | List checkpoints matching filter |
| `deleteThread()` | Delete all checkpoints for a thread |

### Method Signatures

```javascript
class BaseCheckpointSaver {
  // Save checkpoint
  async put(config, checkpoint, metadata) → CheckpointConfig

  // Save intermediate writes
  async putWrites(config, writes, taskId) → void

  // Get checkpoint tuple
  async getTuple(config) → CheckpointTuple | undefined

  // List checkpoints (async generator)
  async *list(config, filter, options) → AsyncGenerator<CheckpointTuple>

  // Delete thread
  async deleteThread(threadId) → void
}
```

---

## Firestore Checkpointer Implementation

Complete implementation for Firebase Firestore:

### Repository Layer

```javascript
// repositories/aiCheckpointRepository.js
import {firestore} from '../config/firebase';

const checkpointsRef = firestore.collection('aiCheckpoints');
const writesRef = firestore.collection('aiCheckpointWrites');

export async function saveCheckpoint(threadId, checkpointNs, checkpointId, parentId, checkpoint, metadata) {
  const docId = `${threadId}_${checkpointNs}_${checkpointId}`;
  await checkpointsRef.doc(docId).set({
    thread_id: threadId,
    checkpoint_ns: checkpointNs,
    checkpoint_id: checkpointId,
    parent_checkpoint_id: parentId,
    checkpoint: JSON.stringify(checkpoint),
    metadata: JSON.stringify(metadata),
    created_at: new Date()
  });
}

export async function getCheckpoint(threadId, checkpointNs, checkpointId) {
  let query = checkpointsRef
    .where('thread_id', '==', threadId)
    .where('checkpoint_ns', '==', checkpointNs);

  if (checkpointId) {
    query = query.where('checkpoint_id', '==', checkpointId);
  }

  const snapshot = await query.orderBy('created_at', 'desc').limit(1).get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0].data();
  return {
    ...doc,
    checkpoint: JSON.parse(doc.checkpoint),
    metadata: JSON.parse(doc.metadata)
  };
}

export async function saveWrites(threadId, checkpointNs, checkpointId, taskId, writes) {
  const docId = `${threadId}_${checkpointId}_${taskId}`;
  await writesRef.doc(docId).set({
    thread_id: threadId,
    checkpoint_ns: checkpointNs,
    checkpoint_id: checkpointId,
    task_id: taskId,
    writes: JSON.stringify(writes),
    created_at: new Date()
  });
}

export async function getWrites(threadId, checkpointId) {
  const snapshot = await writesRef
    .where('thread_id', '==', threadId)
    .where('checkpoint_id', '==', checkpointId)
    .get();

  return snapshot.docs.flatMap(doc => {
    const data = doc.data();
    return JSON.parse(data.writes);
  });
}

export async function listCheckpoints(threadId, checkpointNs, limit) {
  let query = checkpointsRef
    .where('thread_id', '==', threadId)
    .where('checkpoint_ns', '==', checkpointNs)
    .orderBy('created_at', 'desc');

  if (limit) query = query.limit(limit);

  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      checkpoint: JSON.parse(data.checkpoint),
      metadata: JSON.parse(data.metadata)
    };
  });
}

export async function deleteThread(threadId) {
  // Delete checkpoints
  const checkpoints = await checkpointsRef
    .where('thread_id', '==', threadId)
    .get();

  const batch = firestore.batch();
  checkpoints.docs.forEach(doc => batch.delete(doc.ref));

  // Delete writes
  const writes = await writesRef
    .where('thread_id', '==', threadId)
    .get();

  writes.docs.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
}
```

### Checkpointer Class

```javascript
// services/ai/firestoreCheckpointer.js
import {BaseCheckpointSaver} from '@langchain/langgraph-checkpoint';
import * as repo from '../../repositories/aiCheckpointRepository';

export class FirestoreCheckpointer extends BaseCheckpointSaver {
  async put(config, checkpoint, metadata) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) throw new Error('thread_id required');

    const checkpointNs = checkpoint.channel_values?.checkpoint_ns || '';
    const checkpointId = checkpoint.id;
    const parentId = checkpoint.channel_values?.parent_checkpoint_id || null;

    await repo.saveCheckpoint(threadId, checkpointNs, checkpointId, parentId, checkpoint, metadata);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId
      }
    };
  }

  async putWrites(config, writes, taskId) {
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;
    if (!threadId || !checkpointId) {
      throw new Error('thread_id and checkpoint_id required');
    }

    const checkpointNs = config.configurable?.checkpoint_ns || '';
    await repo.saveWrites(threadId, checkpointNs, checkpointId, taskId, writes);
  }

  async getTuple(config) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    const checkpointNs = config.configurable?.checkpoint_ns || '';
    const checkpointId = config.configurable?.checkpoint_id;

    const data = await repo.getCheckpoint(threadId, checkpointNs, checkpointId);
    if (!data) return undefined;

    const pendingWrites = await repo.getWrites(threadId, data.checkpoint_id);

    return {
      config: {
        configurable: {
          thread_id: data.thread_id,
          checkpoint_ns: data.checkpoint_ns,
          checkpoint_id: data.checkpoint_id
        }
      },
      checkpoint: data.checkpoint,
      metadata: data.metadata || {},
      parentConfig: data.parent_checkpoint_id ? {
        configurable: {
          thread_id: data.thread_id,
          checkpoint_ns: data.checkpoint_ns,
          checkpoint_id: data.parent_checkpoint_id
        }
      } : undefined,
      pendingWrites
    };
  }

  async *list(config, filter, options = {}) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const checkpointNs = config.configurable?.checkpoint_ns || '';
    const checkpoints = await repo.listCheckpoints(threadId, checkpointNs, options.limit);

    for (const data of checkpoints) {
      const pendingWrites = await repo.getWrites(threadId, data.checkpoint_id);

      yield {
        config: {
          configurable: {
            thread_id: data.thread_id,
            checkpoint_ns: data.checkpoint_ns,
            checkpoint_id: data.checkpoint_id
          }
        },
        checkpoint: data.checkpoint,
        metadata: data.metadata || {},
        parentConfig: data.parent_checkpoint_id ? {
          configurable: {
            thread_id: data.thread_id,
            checkpoint_ns: data.checkpoint_ns,
            checkpoint_id: data.parent_checkpoint_id
          }
        } : undefined,
        pendingWrites
      };
    }
  }

  async deleteThread(threadId) {
    await repo.deleteThread(threadId);
  }
}
```

---

## Thread Management

### Thread ID Patterns

```javascript
// Per-conversation
const threadId = `conversation-${conversationId}`;

// Per-user per-shop
const threadId = `${shopId}-${userId}`;

// With timestamp for uniqueness
const threadId = `${shopId}-${userId}-${Date.now()}`;
```

### Invoking with Thread ID

```javascript
const result = await app.invoke(
  {messages: [{role: 'user', content: query}]},
  {
    configurable: {
      thread_id: conversationId,
      checkpoint_ns: ''  // Optional namespace
    }
  }
);
```

### Continuing Conversations

```javascript
// First message
await app.invoke(
  {messages: [{role: 'user', content: 'Hello'}]},
  {configurable: {thread_id: 'conv-123'}}
);

// Later - same thread_id loads previous state
await app.invoke(
  {messages: [{role: 'user', content: 'What did I say?'}]},
  {configurable: {thread_id: 'conv-123'}}  // Continues from checkpoint
);
```

---

## Checkpoint Tuple Structure

```javascript
{
  config: {
    configurable: {
      thread_id: 'conversation-123',
      checkpoint_ns: '',
      checkpoint_id: 'uuid-of-checkpoint'
    }
  },
  checkpoint: {
    // Full graph state at this point
    channel_values: {
      messages: [...],
      // other state fields
    },
    id: 'uuid',
    // ... other checkpoint data
  },
  metadata: {
    // Custom metadata (timestamps, etc.)
  },
  parentConfig: {
    // Config of previous checkpoint (for history traversal)
  },
  pendingWrites: [
    // Writes that haven't been committed to a new checkpoint
  ]
}
```

---

## Usage Patterns

### Basic Memory

```javascript
const checkpointer = new FirestoreCheckpointer();
const app = graph.compile({checkpointer});

// Each conversation maintains its own memory
const result = await app.invoke(
  {messages: [{role: 'user', content: 'Hi'}]},
  {configurable: {thread_id: conversationId}}
);
```

### Human-in-the-Loop

```javascript
// Compile with interrupt points
const app = graph.compile({
  checkpointer,
  interruptBefore: ['human_approval']
});

// Invoke - will pause at interrupt
const result = await app.invoke(input, config);

// Later - resume with approval
const resumed = await app.invoke(
  {approval: true},  // Input to continue
  config  // Same config resumes from checkpoint
);
```

### Cleanup Old Threads

```javascript
// Periodic cleanup
async function cleanupOldThreads(maxAge = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxAge);

  const oldCheckpoints = await checkpointsRef
    .where('created_at', '<', cutoff)
    .get();

  const threadIds = [...new Set(oldCheckpoints.docs.map(d => d.data().thread_id))];

  for (const threadId of threadIds) {
    await checkpointer.deleteThread(threadId);
  }
}
```

---

## Production Considerations

### TTL for Checkpoints

Add expiration to prevent unbounded growth:

```javascript
await checkpointsRef.doc(docId).set({
  ...data,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days
});
```

### Indexing

Create Firestore indexes for efficient queries:

```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "aiCheckpoints",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "thread_id", "order": "ASCENDING"},
        {"fieldPath": "checkpoint_ns", "order": "ASCENDING"},
        {"fieldPath": "created_at", "order": "DESCENDING"}
      ]
    }
  ]
}
```

### Error Handling

```javascript
async getTuple(config) {
  try {
    const data = await repo.getCheckpoint(...);
    return data ? formatTuple(data) : undefined;
  } catch (error) {
    console.error('Checkpoint retrieval error:', error);
    return undefined;  // Graceful degradation
  }
}
```

### Monitoring

```javascript
async put(config, checkpoint, metadata) {
  const start = Date.now();

  await repo.saveCheckpoint(...);

  console.log('Checkpoint saved', {
    threadId: config.configurable?.thread_id,
    checkpointId: checkpoint.id,
    duration: Date.now() - start
  });

  return {...};
}
```