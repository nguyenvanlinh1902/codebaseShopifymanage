# StateGraph & State Management

## Table of Contents
- [StateGraph Overview](#stategraph-overview)
- [Annotations](#annotations)
- [MessagesAnnotation](#messagesannotation)
- [Custom State with Reducers](#custom-state-with-reducers)
- [Extending MessagesAnnotation](#extending-messagesannotation)
- [Edges and Conditional Edges](#edges-and-conditional-edges)
- [Graph Compilation](#graph-compilation)

---

## StateGraph Overview

StateGraph is LangGraph's core class for managing state-based computation graphs. Nodes communicate by reading and writing to a shared state.

```javascript
import {StateGraph, MessagesAnnotation} from '@langchain/langgraph';

// Basic StateGraph with MessagesAnnotation
const workflow = new StateGraph(MessagesAnnotation);
```

**Key Characteristics:**
- Each node receives the full state as input
- Each node returns a `Partial<State>` to update
- State updates are merged using reducer functions
- Graph must be compiled before execution via `.compile()`

---

## Annotations

Annotations define the structure and behavior of state. Use `Annotation.Root()` for custom state definitions.

```javascript
import {Annotation} from '@langchain/langgraph';
import {BaseMessage} from '@langchain/core/messages';

// Define custom state with Annotation.Root
const CustomState = Annotation.Root({
  // Simple value (last write wins)
  query: Annotation<string>,

  // With default value
  count: Annotation<number>({
    default: () => 0
  }),

  // With reducer function
  items: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  })
});
```

### Annotation Properties

| Property | Description |
|----------|-------------|
| `default` | Function returning initial value: `() => initialValue` |
| `reducer` | Function to merge updates: `(left, right) => result` |

---

## MessagesAnnotation

Pre-built annotation for chat message state. Handles message merging, ID-based updates, and format conversion.

```javascript
import {MessagesAnnotation} from '@langchain/langgraph';

// MessagesAnnotation is equivalent to:
const MessagesAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  })
});
```

### messagesStateReducer Behavior

The `messagesStateReducer` provides intelligent message handling:

1. **Appends** new messages to the list
2. **Converts** OpenAI format to LangChain format
3. **Updates** existing messages by matching IDs
4. **Handles** tool call/response pairing

```javascript
import {messagesStateReducer} from '@langchain/langgraph';

// Manual usage
const newState = messagesStateReducer(currentMessages, newMessages);
```

---

## Custom State with Reducers

### Reducer Signature

```javascript
// Reducer function signature
(left: Value, right: UpdateValue) => Value

// Examples
const sumReducer = (a, b) => a + b;
const concatReducer = (a, b) => [...a, ...b];
const mergeReducer = (a, b) => ({...a, ...b});
const lastWriteWins = (a, b) => b;
```

### Complete Custom State Example

```javascript
import {Annotation, StateGraph} from '@langchain/langgraph';
import {BaseMessage} from '@langchain/core/messages';
import {messagesStateReducer} from '@langchain/langgraph';

const AgentState = Annotation.Root({
  // Messages with built-in reducer
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),

  // Accumulator (sum all values)
  totalTokens: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0
  }),

  // Collect all documents
  documents: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => []
  }),

  // Last value wins (no reducer needed)
  currentStep: Annotation<string>({
    default: () => 'start'
  }),

  // Object merge
  metadata: Annotation<Record<string, any>>({
    reducer: (a, b) => ({...a, ...b}),
    default: () => ({})
  })
});

const workflow = new StateGraph(AgentState);
```

---

## Extending MessagesAnnotation

Add custom fields while keeping message handling:

```javascript
import {Annotation, MessagesAnnotation} from '@langchain/langgraph';

// Extend with additional state
const ExtendedState = Annotation.Root({
  // Spread in MessagesAnnotation
  ...MessagesAnnotation.spec,

  // Add custom fields
  shopId: Annotation<string>,
  toolCallCount: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0
  }),
  context: Annotation<Record<string, any>>({
    default: () => ({})
  })
});
```

---

## Edges and Conditional Edges

### Edge Types

| Type | Description | Method |
|------|-------------|--------|
| Normal Edge | Direct A → B connection | `.addEdge()` |
| Conditional Edge | Dynamic routing based on state | `.addConditionalEdges()` |
| START Edge | Entry point | `'__start__'` |
| END Edge | Exit point | `'__end__'` |

### Normal Edges

```javascript
workflow
  .addEdge('__start__', 'agent')    // Start → agent
  .addEdge('tools', 'agent')         // tools → agent
```

### Conditional Edges

```javascript
// Simple conditional
function routeMessage(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (lastMessage.tool_calls?.length > 0) {
    return 'tools';
  }
  return '__end__';
}

workflow.addConditionalEdges('agent', routeMessage);

// With explicit mapping
workflow.addConditionalEdges(
  'agent',
  routeMessage,
  {
    tools: 'tools',
    __end__: '__end__'
  }
);
```

### Multi-Path Conditional

```javascript
function routeByIntent(state) {
  const intent = state.intent;

  switch (intent) {
    case 'search': return 'search_node';
    case 'calculate': return 'math_node';
    case 'chat': return 'chat_node';
    default: return '__end__';
  }
}

workflow.addConditionalEdges('classifier', routeByIntent);
```

---

## Graph Compilation

### Basic Compilation

```javascript
const app = workflow.compile();
```

### With Checkpointer (Memory)

```javascript
import {MemorySaver} from '@langchain/langgraph';

const checkpointer = new MemorySaver();
const app = workflow.compile({checkpointer});

// Invoke with thread_id for memory
const result = await app.invoke(
  {messages: [{role: 'user', content: 'Hello'}]},
  {configurable: {thread_id: 'user-123'}}
);
```

### With Interrupt Points

```javascript
const app = workflow.compile({
  checkpointer,
  interruptBefore: ['human_review'],  // Pause before this node
  interruptAfter: ['sensitive_action'] // Pause after this node
});
```

---

## Node Implementation Pattern

```javascript
// Node receives state, returns partial update
async function agentNode(state) {
  const response = await model.invoke(state.messages);

  return {
    messages: [response],           // Merged via messagesStateReducer
    totalTokens: response.usage,    // Added via sum reducer
    currentStep: 'agent_complete'   // Overwrites (no reducer)
  };
}

workflow.addNode('agent', agentNode);
```

---

## Complete Example

```javascript
import {Annotation, StateGraph, messagesStateReducer} from '@langchain/langgraph';
import {ToolNode} from '@langchain/langgraph/prebuilt';
import {ChatOpenAI} from '@langchain/openai';
import {BaseMessage} from '@langchain/core/messages';

// 1. Define State
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  iterationCount: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0
  })
});

// 2. Define Nodes
const model = new ChatOpenAI({model: 'gpt-4o'});

async function agentNode(state) {
  const boundModel = model.bindTools(tools);
  const response = await boundModel.invoke(state.messages);
  return {
    messages: [response],
    iterationCount: 1
  };
}

// 3. Define Routing
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  // Safety: limit iterations
  if (state.iterationCount >= 10) {
    return '__end__';
  }

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return '__end__';
  }
  return 'tools';
}

// 4. Build Graph
const workflow = new StateGraph(AgentState)
  .addNode('agent', agentNode)
  .addNode('tools', new ToolNode(tools))
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

// 5. Compile
const app = workflow.compile({checkpointer});
```
