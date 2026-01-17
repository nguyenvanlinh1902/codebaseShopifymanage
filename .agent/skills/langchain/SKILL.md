---
name: langchain
description: Use this skill when the user asks about "LangChain", "LangGraph", "StateGraph", "agent graph", "tool node", "DynamicStructuredTool", "checkpointer", "streamEvents", "agent workflow", "AI agent", "ChatOpenAI", "MessagesAnnotation", "Annotation", "reducer", "bindTools", "withStructuredOutput", "HumanMessage", "AIMessage", "ToolMessage", or any LangChain/LangGraph development work. Provides patterns for building AI agents with LangChain and LangGraph in Node.js.
---

# LangChain & LangGraph Development Guide

## Quick Reference

| Topic | Reference File |
|-------|---------------|
| StateGraph, Annotations, Reducers | [references/state-management.md](references/state-management.md) |
| DynamicStructuredTool, bindTools | [references/tools.md](references/tools.md) |
| streamEvents, Token Streaming | [references/streaming.md](references/streaming.md) |
| Checkpointer, Memory Persistence | [references/checkpointer.md](references/checkpointer.md) |

---

## Core Dependencies

```javascript
// LangChain Core
import {ChatOpenAI} from '@langchain/openai';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {DynamicStructuredTool} from '@langchain/core/tools';
import {HumanMessage, AIMessage, SystemMessage, ToolMessage} from '@langchain/core/messages';

// LangGraph
import {StateGraph, MessagesAnnotation, Annotation} from '@langchain/langgraph';
import {ToolNode} from '@langchain/langgraph/prebuilt';
import {messagesStateReducer} from '@langchain/langgraph';
import {BaseCheckpointSaver} from '@langchain/langgraph-checkpoint';

// Schema Validation
import {z} from 'zod';
```

---

## LangChain vs LangGraph

| Use Case | Recommendation |
|----------|----------------|
| Simple chat completions | LangChain ChatModel |
| Rapid agent prototyping | LangChain Agents |
| Deterministic workflows | **LangGraph** |
| Heavy customization | **LangGraph** |
| Precise latency control | **LangGraph** |
| Human-in-the-loop | **LangGraph** |
| Memory persistence | **LangGraph + Checkpointer** |

---

## Basic Agent Pattern

```javascript
import {ChatOpenAI} from '@langchain/openai';
import {StateGraph, MessagesAnnotation} from '@langchain/langgraph';
import {ToolNode} from '@langchain/langgraph/prebuilt';

const model = new ChatOpenAI({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  streaming: true
});

// Define model call with tool binding
const callModel = async state => {
  const systemMessage = {role: 'system', content: 'You are a helpful assistant.'};
  const boundModel = model.bindTools(tools);
  const response = await boundModel.invoke([systemMessage, ...state.messages]);
  return {messages: [response]};
};

// Conditional edge function
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return '__end__';
  }
  return 'tools';
}

// Build and compile graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(tools))
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

const app = workflow.compile({checkpointer});
```

---

## Message Types

```javascript
import {HumanMessage, AIMessage, SystemMessage, ToolMessage} from '@langchain/core/messages';

// System message (first in conversation)
const system = new SystemMessage('You are a helpful assistant.');

// User input
const human = new HumanMessage('What is the weather?');

// AI response (may include tool_calls)
const ai = new AIMessage({
  content: '',
  tool_calls: [{id: 'call_123', name: 'get_weather', args: {city: 'NYC'}}]
});

// Tool response (must match tool_call_id)
const tool = new ToolMessage({
  tool_call_id: 'call_123',
  content: 'Weather in NYC: 72°F, sunny'
});
```

**Message Order Rules:**
- Start with `SystemMessage` (optional) + `HumanMessage`
- `ToolMessage` must follow `AIMessage` with `tool_calls`
- Most chat models expect alternating user/assistant pattern

---

## Structured Output

### withStructuredOutput (Recommended)

```javascript
import {z} from 'zod';

const responseSchema = z.object({
  answer: z.string().describe('The answer to the question'),
  sources: z.array(z.string()).describe('Source references'),
  confidence: z.number().min(0).max(1).describe('Confidence score')
});

const structuredModel = model.withStructuredOutput(responseSchema);
const result = await structuredModel.invoke('What is LangChain?');
// result: { answer: '...', sources: ['...'], confidence: 0.95 }
```

### bindTools vs withStructuredOutput

| Method | Purpose |
|--------|---------|
| `.bindTools()` | Call external tools, execute functions |
| `.withStructuredOutput()` | Enforce response format, no execution |

---

## Quick Tool Example

```javascript
import {DynamicStructuredTool} from '@langchain/core/tools';
import {z} from 'zod';

const weatherTool = new DynamicStructuredTool({
  name: 'get_weather',
  description: 'Get current weather for a city. Use when user asks about weather.',
  schema: z.object({
    city: z.string().describe('City name, e.g., "New York"'),
    units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units')
  }),
  func: async ({city, units = 'fahrenheit'}) => {
    // Return string (not throw error) for LLM to handle
    try {
      const weather = await fetchWeather(city, units);
      return `Weather in ${city}: ${weather.temp}°${units === 'celsius' ? 'C' : 'F'}`;
    } catch (error) {
      return `Error getting weather for ${city}: ${error.message}`;
    }
  }
});
```

---

## Project Structure (Joy App)

```
packages/functions/src/services/ai/
├── langchainService.js       # Main agent graph, askAi function
├── firestoreCheckpointer.js  # Memory persistence
├── imageAnalysisService.js   # Image processing
└── tools/
    ├── shopifyToolService.js     # Shopify API tools
    ├── inAppToolService.js       # App-specific tools
    ├── ragToolService.js         # Documentation RAG
    ├── webSearchToolService.js   # Web search tools
    ├── reportToolService.js      # Analytics tools
    └── navigationToolService.js  # Navigation tools
```

---

## Multi-Agent Architecture

For complex applications with specialized agents, use the factory pattern:

```
packages/functions/src/services/ai/
├── agentFactory.js           # Tool registry, agent creation
├── agentRouter.js            # Route queries to specialist agents
├── supervisorService.js      # Orchestrate multi-agent workflows
├── agents/
│   └── baseAgent.js          # Base agent class with common logic
├── prompts/
│   └── index.js              # System prompts by agent type
└── tools/
    ├── productTools.js       # Product-specific tools
    ├── orderTools.js         # Order-specific tools
    ├── customerTools.js      # Customer-specific tools
    ├── marketingTools.js     # Marketing/discount tools
    ├── routingTools.js       # Tools for routing between agents
    └── skillTools.js         # Dynamic skill loading tools
```

### Agent Factory Pattern

```javascript
// agentFactory.js
import {AGENT_TYPES, AGENT_CONFIGS} from '@functions/config/aiAgents';

// Centralized tool registry
const TOOL_REGISTRY = {
  product_search: productSearchTool,
  order_list: orderListTool,
  customer_get: customerGetTool,
  // ... more tools
};

// Singleton checkpointer (multi-tenant)
let checkpointerInstance = null;
function getCheckpointer() {
  if (!checkpointerInstance) {
    checkpointerInstance = new FirestoreCheckpointer();
  }
  return checkpointerInstance;
}

// Create agent with configured tools
export function createAgent({agentType, customTools = []}) {
  const config = AGENT_CONFIGS[agentType];
  const tools = config.tools.map(name => TOOL_REGISTRY[name]).filter(Boolean);

  return new BaseAgent({
    agentType,
    tools: [...tools, ...customTools],
    systemPrompt: getSystemPrompt(agentType),
    checkpointer: getCheckpointer()
  });
}
```

### Agent Configuration

```javascript
// config/aiAgents.js
export const AGENT_TYPES = {
  MASTER: 'master',
  ANALYTICS: 'analytics',
  PRODUCT: 'product',
  ORDER: 'order',
  CUSTOMER: 'customer',
  MARKETING: 'marketing'
};

export const AGENT_CONFIGS = {
  [AGENT_TYPES.MASTER]: {
    name: 'Master Agent',
    description: 'Routes queries to specialist agents',
    tools: ['route_to_analytics', 'route_to_product', 'route_to_order']
  },
  [AGENT_TYPES.PRODUCT]: {
    name: 'Product Agent',
    description: 'Handles product queries and updates',
    tools: ['product_search', 'product_get', 'product_update', 'inventory_get']
  }
  // ... more agent configs
};
```

### Dynamic Tool Registration

```javascript
// Register custom tools at runtime
import {registerTool, unregisterTool} from './agentFactory';

// Add shop-specific tool
registerTool('custom_loyalty_check', createLoyaltyTool(shopConfig));

// Remove tool when no longer needed
unregisterTool('custom_loyalty_check');
```

### Multi-Agent Routing

```javascript
// routingTools.js - Tools for master agent to delegate
export const routeToProductTool = new DynamicStructuredTool({
  name: 'route_to_product',
  description: 'Route product-related queries to the Product specialist agent',
  schema: z.object({
    query: z.string().describe('The product-related query to handle'),
    context: z.string().optional().describe('Additional context')
  }),
  func: async ({query, context}) => {
    // Delegate to product agent
    const productAgent = createAgent({agentType: AGENT_TYPES.PRODUCT});
    return await productAgent.invoke(query, {context});
  }
});
```

### Multi-Tenant Checkpointer

The `FirestoreCheckpointer` requires `shopId` in config for isolation:

```javascript
// CRITICAL: Always pass shopId in metadata
const config = {
  configurable: {thread_id: conversationId},
  metadata: {shopId}  // Required for multi-tenant isolation
};

const result = await agent.invoke(messages, config);
```

---

## Development Checklist

```
□ Tools have detailed descriptions with examples
□ Zod schemas include .describe() for all fields
□ Error handling returns strings, not throws
□ streamEvents used for token-level streaming
□ Checkpointer configured for conversation memory
□ Tool call limits prevent infinite loops (max 20)
□ Conversation summarization for long chats (>15 msgs)
□ Metadata passed through config for context
□ MessagesAnnotation used with messagesStateReducer
□ Config propagated to child runnables for streaming
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| streamEvents not emitting | Propagate RunnableConfig to child runnables |
| Zod warnings in console | Suppress with custom error map (see references/tools.md) |
| Tool calls in infinite loop | Add tool call counter in shouldContinue |
| Context overflow | Enable conversation summarization middleware |
| Missing tool results | Ensure ToolMessage.tool_call_id matches AIMessage |

---

## External Resources

- [LangChain.js Docs](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangGraph.js API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html)
- [LangGraph Concepts](https://langchain-ai.github.io/langgraphjs/concepts/low_level/)
- [@langchain/langgraph-checkpoint](https://www.npmjs.com/package/@langchain/langgraph-checkpoint)
