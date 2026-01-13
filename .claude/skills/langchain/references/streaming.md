# Streaming & streamEvents

## Table of Contents
- [Streaming Overview](#streaming-overview)
- [streamEvents API](#streamevents-api)
- [Event Types](#event-types)
- [Token-Level Streaming](#token-level-streaming)
- [Tool Call Streaming](#tool-call-streaming)
- [Config Propagation](#config-propagation)
- [HTTP Server-Sent Events](#http-server-sent-events)
- [Complete Implementation](#complete-implementation)

---

## Streaming Overview

LangGraph provides two main streaming approaches:

| Method | Use Case |
|--------|----------|
| `.stream()` | Stream full state updates after each node |
| `.streamEvents()` | Stream granular events (tokens, tool calls, etc.) |

For token-level streaming (like ChatGPT), use `.streamEvents()`.

---

## streamEvents API

```javascript
const eventStream = graph.streamEvents(
  {messages: [{role: 'user', content: query}]},
  {
    configurable: {thread_id: conversationId},
    metadata: {shopId, channel},
    version: 'v2'  // Required for latest event format
  }
);

for await (const event of eventStream) {
  // Process events
}
```

### Required: version: 'v2'

Always use `version: 'v2'` for the latest event format and proper streaming behavior.

---

## Event Types

### Event Name Format

Events follow the pattern: `on_[runnable_type]_(start|stream|end)`

| Event | Description |
|-------|-------------|
| `on_chat_model_start` | Model invocation started |
| `on_chat_model_stream` | Token chunk received |
| `on_chat_model_end` | Model invocation completed |
| `on_tool_start` | Tool execution started |
| `on_tool_end` | Tool execution completed |
| `on_chain_start` | Chain/graph started |
| `on_chain_end` | Chain/graph completed |

### Event Structure

```javascript
{
  event: 'on_chat_model_stream',
  name: 'ChatOpenAI',
  run_id: 'uuid',
  data: {
    chunk: {
      content: 'token text',
      // ... other chunk properties
    }
  }
}
```

---

## Token-Level Streaming

Stream tokens as they're generated:

```javascript
let output = '';

for await (const event of eventStream) {
  if (event.event === 'on_chat_model_stream') {
    const content = event.data?.chunk?.content;
    if (content) {
      // Send to client
      onToken({type: 'delta', content});
      output += content;
    }
  }
}
```

### With Callback Pattern

```javascript
async function streamResponse({query, onToken}) {
  const eventStream = graph.streamEvents(
    {messages: [{role: 'user', content: query}]},
    {version: 'v2'}
  );

  for await (const event of eventStream) {
    if (event.event === 'on_chat_model_stream') {
      const content = event.data?.chunk?.content;
      if (content && onToken) {
        onToken(content);
      }
    }
  }
}

// Usage
await streamResponse({
  query: 'Hello',
  onToken: (token) => process.stdout.write(token)
});
```

---

## Tool Call Streaming

Detect and stream tool calls:

```javascript
for await (const event of eventStream) {
  // Token streaming
  if (event.event === 'on_chat_model_stream') {
    const content = event.data?.chunk?.content;
    if (content) {
      onToken({type: 'delta', content});
    }
  }

  // Tool calls detected (model decided to use tools)
  if (event.event === 'on_chat_model_end') {
    const toolCalls = event.data?.output?.tool_calls;
    if (toolCalls?.length > 0) {
      for (const toolCall of toolCalls) {
        onToken({
          type: 'reasoning',
          content: `Using ${toolCall.name}...`
        });
      }
    }
  }

  // Tool execution started
  if (event.event === 'on_tool_start') {
    console.log('Tool started:', event.name);
  }

  // Tool execution completed
  if (event.event === 'on_tool_end') {
    console.log('Tool completed:', event.name);
    const result = event.data?.output;
    // Process tool result if needed
  }
}
```

### Human-Friendly Tool Messages

```javascript
function getToolMessage(toolName, args) {
  const messages = {
    'shopify_get_orders': () => `Looking up order information...`,
    'get_customer_data': () => `Fetching customer data for ${args.email}...`,
    'search_activities': () => `Searching activity history...`,
    'answer_documentation': () => `Searching documentation for "${args.query}"...`
  };

  return messages[toolName]?.() || `Running ${toolName}...`;
}

// Usage in stream loop
if (event.event === 'on_chat_model_end' && event.data?.output?.tool_calls) {
  for (const {name, args} of event.data.output.tool_calls) {
    onToken({
      type: 'reasoning',
      content: getToolMessage(name, args)
    });
  }
}
```

---

## Config Propagation

**Critical:** LangChain doesn't automatically propagate config to child runnables. This causes `streamEvents` to miss events from nested components.

### Problem

```javascript
// BAD: Config not propagated - events missing
async function myNode(state) {
  const result = await someChain.invoke(state.messages);
  return {messages: [result]};
}
```

### Solution

```javascript
// GOOD: Propagate config to child runnables
async function myNode(state, config) {
  const result = await someChain.invoke(state.messages, config);
  return {messages: [result]};
}
```

### In DynamicStructuredTool

```javascript
const myTool = new DynamicStructuredTool({
  name: 'my_tool',
  schema: z.object({...}),
  func: async (args, runManager, config) => {
    // Pass config to any nested LangChain calls
    const result = await subChain.invoke(args, config);
    return result;
  }
});
```

---

## HTTP Server-Sent Events

Stream events directly to HTTP responses (works with Express, Hono, Next.js):

```javascript
import {streamEvents} from '@langchain/langgraph';

// Express handler
app.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const eventStream = graph.streamEvents(
    {messages: [{role: 'user', content: req.query.message}]},
    {version: 'v2'}
  );

  for await (const event of eventStream) {
    if (event.event === 'on_chat_model_stream') {
      const content = event.data?.chunk?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({type: 'token', content})}\n\n`);
      }
    }
  }

  res.write(`data: ${JSON.stringify({type: 'done'})}\n\n`);
  res.end();
});
```

---

## Complete Implementation

Full streaming implementation with all event handling:

```javascript
export async function askAi({query, conversationId, shopId, onToken}) {
  const graph = await getAgent();

  // Track tool executions
  const toolExecutions = [];
  let finalOutput = '';

  const eventStream = graph.streamEvents(
    {messages: [{role: 'user', content: query}]},
    {
      configurable: {thread_id: conversationId},
      metadata: {shopId},
      version: 'v2'
    }
  );

  for await (const event of eventStream) {
    // 1. Token streaming
    if (event.event === 'on_chat_model_stream') {
      const content = event.data?.chunk?.content;
      if (content && onToken) {
        onToken({type: 'delta', content});
        finalOutput += content;
      }
    }

    // 2. Tool calls detected
    if (event.event === 'on_chat_model_end') {
      const toolCalls = event.data?.output?.tool_calls;
      if (toolCalls?.length > 0) {
        for (const toolCall of toolCalls) {
          // Track execution
          const execution = {
            name: toolCall.name,
            args: toolCall.args,
            startTime: Date.now()
          };
          toolExecutions.push(execution);

          // Notify client
          if (onToken) {
            const message = getToolMessage(toolCall.name, toolCall.args);
            onToken({type: 'reasoning', content: message});
          }
        }
      }
    }

    // 3. Tool execution completed
    if (event.event === 'on_tool_end') {
      const lastExecution = toolExecutions[toolExecutions.length - 1];
      if (lastExecution) {
        lastExecution.result = event.data?.output;
        lastExecution.duration = Date.now() - lastExecution.startTime;
      }
    }
  }

  return {
    output: finalOutput,
    toolExecutions
  };
}
```

### Deduplication for Tool Messages

Prevent duplicate reasoning messages:

```javascript
const sentMessages = new Set();

for await (const event of eventStream) {
  if (event.event === 'on_chat_model_end') {
    const toolCalls = event.data?.output?.tool_calls || [];

    for (const toolCall of toolCalls) {
      // Create unique key
      const key = `${toolCall.name}-${JSON.stringify(toolCall.args)}`;

      if (!sentMessages.has(key)) {
        sentMessages.add(key);
        onToken({
          type: 'reasoning',
          content: getToolMessage(toolCall.name, toolCall.args)
        });
      }
    }
  }
}
```