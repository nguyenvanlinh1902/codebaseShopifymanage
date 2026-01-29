---
name: langchain
description: Use this skill when the user asks about "LangChain", "LangGraph", "StateGraph", "agent graph", "tool node", "DynamicStructuredTool", "checkpointer", "streamEvents", "agent workflow", "AI agent", "ChatOpenAI", "MessagesAnnotation", "Annotation", "reducer", "bindTools", "withStructuredOutput", "HumanMessage", "AIMessage", "ToolMessage", or any LangChain/LangGraph development work. Provides patterns for building AI agents with LangChain and LangGraph in Node.js.
---

# LangChain & LangGraph Development Guide

## CRITICAL: Version Requirements (v1)

This project uses **LangChain v1 / LangGraph v1**. All code MUST use v1 APIs.

```json
{
  "@langchain/core": "^1.1.8",
  "@langchain/langgraph": "^1.1.0",
  "@langchain/langgraph-checkpoint": "^1.0.0",
  "@langchain/langgraph-supervisor": "^1.0.1",
  "@langchain/openai": "^1.2.0",
  "@langchain/mcp-adapters": "^1.1.1",
  "zod": "^3.24.1"
}
```

### v1 Breaking Changes - DO NOT USE Old Patterns

| Old Pattern (v0) | v1 Pattern | Notes |
|---|---|---|
| `import {createReactAgent} from 'langchain/agents'` | `import {createReactAgent} from '@langchain/langgraph/prebuilt'` | Different API |
| `stateModifier` in createReactAgent | `messageModifier` or `prompt` (function) | `stateModifier` removed |
| `AgentExecutor` | `createReactAgent` from `@langchain/langgraph/prebuilt` | AgentExecutor is deprecated |
| `initializeAgentExecutorWithOptions` | `createReactAgent` | Deprecated |
| `new ChatOpenAI({modelName: '...'})` | `new ChatOpenAI({model: '...'})` | `modelName` renamed to `model` |
| `streamEvents` without `version` | `streamEvents(input, {...config, version: 'v2'})` | v2 required |
| `createReactAgent` without `version` | `createReactAgent({..., version: 'v2'})` | Required for subgraph interrupts |
| `import {BaseCheckpointSaver} from '@langchain/langgraph'` | `import {BaseCheckpointSaver} from '@langchain/langgraph-checkpoint'` | Separate package |
| Custom supervisor routing tools | `import {createSupervisor} from '@langchain/langgraph-supervisor'` | Built-in supervisor |

---

## Quick Reference

| Topic | Reference File |
|-------|---------------|
| StateGraph, Annotations, Reducers | [references/state-management.md](references/state-management.md) |
| DynamicStructuredTool, bindTools | [references/tools.md](references/tools.md) |
| streamEvents, Token Streaming | [references/streaming.md](references/streaming.md) |
| Checkpointer, Memory Persistence | [references/checkpointer.md](references/checkpointer.md) |
| Human-in-the-Loop (HITL) | [references/human-in-the-loop.md](references/human-in-the-loop.md) |
| HITL Frontend Hook | [references/hitl-frontend-hook.md](references/hitl-frontend-hook.md) |
| Tool UI Streaming | [references/tool-ui.md](references/tool-ui.md) |
| Todo Middleware | [references/todo-middleware.md](references/todo-middleware.md) |
| **Multi-Agent Architecture** | [references/multi-agent-architecture.md](references/multi-agent-architecture.md) |
| Web Search Tools (Free) | [references/web-search-tools.md](references/web-search-tools.md) |
| **Tool Creation Guide** | [references/tool-creation.md](references/tool-creation.md) |

---

## Core v1 Imports

```javascript
// LangChain Core (v1)
import {ChatOpenAI} from '@langchain/openai';                           // ^1.2.0
import {ChatPromptTemplate} from '@langchain/core/prompts';             // ^1.1.8
import {DynamicStructuredTool} from '@langchain/core/tools';            // ^1.1.8
import {HumanMessage, AIMessage, SystemMessage, ToolMessage} from '@langchain/core/messages'; // ^1.1.8

// LangGraph (v1)
import {StateGraph, MessagesAnnotation, Annotation} from '@langchain/langgraph';  // ^1.1.0
import {ToolNode} from '@langchain/langgraph/prebuilt';                           // ^1.1.0
import {createReactAgent} from '@langchain/langgraph/prebuilt';                   // ^1.1.0
import {messagesStateReducer} from '@langchain/langgraph';                        // ^1.1.0

// LangGraph Checkpoint (v1 - SEPARATE PACKAGE)
import {BaseCheckpointSaver} from '@langchain/langgraph-checkpoint';              // ^1.0.0

// LangGraph Supervisor (v1 - SEPARATE PACKAGE)
import {createSupervisor} from '@langchain/langgraph-supervisor';                 // ^1.0.1

// Schema Validation
import {z} from 'zod';                                                           // ^3.24.1
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

## Reference Code: createReactAgent (from avadaAgentFactory.js)

This is the pattern used in our codebase for single-agent creation:

```javascript
import {createReactAgent} from '@langchain/langgraph/prebuilt';
import {ChatOpenAI} from '@langchain/openai';
import {HumanMessage, SystemMessage} from '@langchain/core/messages';
import {FirestoreCheckpointer} from './firestoreCheckpointer';

// Singleton checkpointer
let checkpointerInstance = null;
function getCheckpointer() {
  if (!checkpointerInstance) {
    checkpointerInstance = new FirestoreCheckpointer();
  }
  return checkpointerInstance;
}

// Create model
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',   // Use 'model' NOT 'modelName'
  temperature: 0,
  streaming: true
});

// Create agent with messageModifier for prompt injection + message trimming
const agent = createReactAgent({
  llm,
  tools: allTools,
  checkpointSaver: getCheckpointer(),
  messageModifier: state => {
    // Trim messages to prevent Firestore 1MB limit
    const messages = state.messages;
    const maxMessages = 50;
    const trimmedMessages =
      messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

    // Prepend system message to the conversation
    return [new SystemMessage(systemPrompt), ...trimmedMessages];
  }
});

// Invoke with thread config
const result = await agent.invoke(
  {messages: [new HumanMessage(query)]},
  {
    configurable: {
      thread_id: threadId,
      checkpoint_ns: shopId ? `shop:${shopId}` : undefined
    },
    metadata: {appId, shopId}
  }
);
```

---

## Reference Code: Supervisor Pattern (from supervisorService.js)

This is the pattern used in our codebase for multi-agent orchestration:

```javascript
import {createSupervisor} from '@langchain/langgraph-supervisor';
import {createReactAgent} from '@langchain/langgraph/prebuilt';
import {ChatOpenAI} from '@langchain/openai';

// ============================================
// 1. CREATE SPECIALIST AGENTS
// ============================================

function createSpecialistAgent(name, tools, getPrompt) {
  const model = new ChatOpenAI({
    model: 'gpt-4o',
    temperature: 0  // Low temperature for reliable tool calling
  });

  // Use prompt FUNCTION (not string) to inject system prompt
  const promptFn = state => [
    {role: 'system', content: getPrompt()},
    ...state.messages
  ];

  return createReactAgent({
    llm: model,
    tools: tools,
    name: name,
    prompt: promptFn,
    // CRITICAL: version 'v2' for proper interrupt handling in subgraphs
    // v2 executes each tool call in a separate node instance
    version: 'v2'
  });
}

const marketingAgent = createSpecialistAgent(
  'marketing_agent',
  MARKETING_TOOLS,
  getMarketingAgentPrompt
);

const customerAgent = createSpecialistAgent(
  'customer_agent',
  CUSTOMER_TOOLS,
  getCustomerAgentPrompt
);

// ============================================
// 2. CREATE SUPERVISOR
// ============================================

const supervisorModel = new ChatOpenAI({
  model: 'gpt-4o',
  temperature: 0.3
});

const supervisor = createSupervisor({
  agents: [marketingAgent, customerAgent, productAgent, orderAgent],
  llm: supervisorModel,
  prompt: getSupervisorPrompt(),
  tools: [writeTodosTool],           // Supervisor-level tools only
  outputMode: 'last_message',        // v1: return last agent message
  addHandoffBackMessages: false      // v1: disable auto handoff-back messages
});

// ============================================
// 3. COMPILE WITH CHECKPOINTER
// ============================================

const app = supervisor.compile({
  checkpointer: getCheckpointer()
});

// ============================================
// 4. STREAM EVENTS (v2 format)
// ============================================

const eventStream = app.streamEvents(
  {messages: [{role: 'user', content: query}]},
  {
    configurable: {thread_id: conversationId},
    metadata: {shopId},
    version: 'v2'   // REQUIRED for latest event format
  }
);

for await (const event of eventStream) {
  if (event.event === 'on_chat_model_stream') {
    const content = event.data?.chunk?.content;
    if (content) {
      onToken({type: 'delta', content});
    }
  }
}
```

---

## createReactAgent: prompt vs messageModifier

In **v1**, `createReactAgent` supports two ways to inject system prompts:

### Option 1: `prompt` (function) - For supervisor subgraphs

```javascript
// Use when agent is a SUBGRAPH of a supervisor
createReactAgent({
  llm: model,
  tools: tools,
  name: 'agent_name',
  prompt: state => [
    {role: 'system', content: 'System prompt here'},
    ...state.messages
  ],
  version: 'v2'   // Required for subgraph interrupts
});
```

### Option 2: `messageModifier` - For standalone agents

```javascript
// Use for standalone agents with message trimming
createReactAgent({
  llm: model,
  tools: allTools,
  checkpointSaver: checkpointer,
  messageModifier: state => {
    const messages = state.messages;
    const trimmed = messages.length > 50 ? messages.slice(-50) : messages;
    return [new SystemMessage(systemPrompt), ...trimmed];
  }
});
```

### DO NOT USE (deprecated/wrong):

```javascript
// WRONG: stateModifier does not exist in v1
createReactAgent({
  stateModifier: systemPrompt  // ❌ Removed in v1
});

// WRONG: prompt as string (only works as function)
createReactAgent({
  prompt: 'You are a helpful assistant'  // ❌ Must be function
});
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

## Project Structure

```
packages/functions/src/services/ai/
├── avadaAgentFactory.js     # Standard agent factory (createReactAgent + messageModifier)
├── supervisorService.js     # Multi-agent supervisor (createSupervisor + specialist agents)
├── firestoreCheckpointer.js # Memory persistence (extends BaseCheckpointSaver)
├── plugins/
│   ├── pluginRegistry.js    # Plugin registration system
│   ├── coreTools.js         # Shared core tools
│   └── scopeFilter.js       # Scope-based tool filtering
├── prompts/
│   └── standardAgentPrompt.js  # System prompts
└── tools/
    ├── shopifyToolService.js     # Shopify API tools
    ├── inAppToolService.js       # App-specific tools
    ├── ragToolService.js         # Documentation RAG
    ├── webSearchToolService.js   # Web search tools
    ├── reportToolService.js      # Analytics tools
    └── navigationToolService.js  # Navigation tools
```

---

## createSupervisor v1 Options

```javascript
import {createSupervisor} from '@langchain/langgraph-supervisor';

const supervisor = createSupervisor({
  // Required
  agents: [agent1, agent2],              // Array of createReactAgent instances
  llm: supervisorModel,                  // ChatOpenAI instance
  prompt: 'Supervisor system prompt',    // String or function

  // Optional
  tools: [supervisorTool],              // Supervisor-level tools (not agent tools)
  outputMode: 'last_message',           // 'last_message' | 'full_history'
  addHandoffBackMessages: false,        // Disable auto handoff-back messages
});

const app = supervisor.compile({
  checkpointer: getCheckpointer()
});
```

---

## Basic StateGraph Pattern

For custom graph workflows (when createReactAgent isn't enough):

```javascript
import {ChatOpenAI} from '@langchain/openai';
import {StateGraph, MessagesAnnotation} from '@langchain/langgraph';
import {ToolNode} from '@langchain/langgraph/prebuilt';

const model = new ChatOpenAI({
  model: 'gpt-4o',    // NOT modelName
  streaming: true
});

const callModel = async state => {
  const systemMessage = {role: 'system', content: 'You are a helpful assistant.'};
  const boundModel = model.bindTools(tools);
  const response = await boundModel.invoke([systemMessage, ...state.messages]);
  return {messages: [response]};
};

function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return '__end__';
  }
  return 'tools';
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(tools))
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

const app = workflow.compile({checkpointer});
```

---

## Development Checklist

```
□ Using v1 packages (@langchain/core ^1.1.8, @langchain/langgraph ^1.1.0)
□ Using 'model' not 'modelName' in ChatOpenAI
□ Using createReactAgent from '@langchain/langgraph/prebuilt' (NOT langchain/agents)
□ Using BaseCheckpointSaver from '@langchain/langgraph-checkpoint' (separate package)
□ Using createSupervisor from '@langchain/langgraph-supervisor' (separate package)
□ Using version: 'v2' in createReactAgent for subgraph agents
□ Using version: 'v2' in streamEvents calls
□ Using prompt function (not string) in createReactAgent for supervisor subgraphs
□ Using messageModifier in createReactAgent for standalone agents
□ Tools have detailed descriptions with examples
□ Zod schemas include .describe() for all fields
□ Error handling returns strings, not throws
□ Checkpointer configured for conversation memory
□ Tool call limits prevent infinite loops (max 20)
□ Message windowing to prevent Firestore 1MB limit (max 50 messages)
□ Metadata passed through config for context
□ Config propagated to child runnables for streaming
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `modelName` not working | Use `model` instead (v1 change) |
| `stateModifier` not working | Use `messageModifier` or `prompt` (function) |
| `AgentExecutor` deprecated | Use `createReactAgent` from `@langchain/langgraph/prebuilt` |
| streamEvents not emitting | Add `version: 'v2'` and propagate RunnableConfig |
| Zod warnings in console | Suppress with custom error map (see references/tools.md) |
| Tool calls in infinite loop | Add tool call counter in shouldContinue |
| Context overflow | Enable message windowing (maxMessages in messageModifier) |
| Missing tool results | Ensure ToolMessage.tool_call_id matches AIMessage |
| **LLM not calling tools** | **Split into specialist agents with 5-15 tools each** |
| HITL not working in subgraph | Add `version: 'v2'` to createReactAgent |
| BaseCheckpointSaver import fails | Import from `@langchain/langgraph-checkpoint` (separate package) |
| createSupervisor import fails | Import from `@langchain/langgraph-supervisor` (separate package) |

---

## External Resources

- [LangChain.js Docs](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangGraph.js API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html)
- [LangGraph Concepts](https://langchain-ai.github.io/langgraphjs/concepts/low_level/)
- [@langchain/langgraph-checkpoint](https://www.npmjs.com/package/@langchain/langgraph-checkpoint)
- [@langchain/langgraph-supervisor](https://www.npmjs.com/package/@langchain/langgraph-supervisor)
