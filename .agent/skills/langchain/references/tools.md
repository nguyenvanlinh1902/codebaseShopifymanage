# Tools & DynamicStructuredTool

## Table of Contents
- [DynamicStructuredTool Overview](#dynamicstructuredtool-overview)
- [Zod Schema Best Practices](#zod-schema-best-practices)
- [Error Handling](#error-handling)
- [Accessing Config and Metadata](#accessing-config-and-metadata)
- [Tool Response Formatting](#tool-response-formatting)
- [ToolNode Integration](#toolnode-integration)
- [bindTools Usage](#bindtools-usage)
- [Zod Warnings Suppression](#zod-warnings-suppression)
- [Complete Examples](#complete-examples)

---

## DynamicStructuredTool Overview

`DynamicStructuredTool` creates tools dynamically with Zod schema validation. The LLM uses the name and description to decide when and how to call the tool.

```javascript
import {DynamicStructuredTool} from '@langchain/core/tools';
import {z} from 'zod';

const myTool = new DynamicStructuredTool({
  name: 'tool_name',           // Snake_case, descriptive
  description: 'When to use this tool and what it does.',
  schema: z.object({...}),     // Zod schema for inputs
  func: async (args, runManager, config) => {
    // Implementation - return string
  }
});
```

---

## Zod Schema Best Practices

### Always Use .describe()

The description helps the LLM understand each parameter:

```javascript
// BAD: No descriptions
schema: z.object({
  id: z.string(),
  limit: z.number().optional()
})

// GOOD: Detailed descriptions with examples
schema: z.object({
  orderId: z.string()
    .describe('Shopify order ID (long numeric). Example: "6552244224222"'),
  orderName: z.string()
    .optional()
    .describe('Order number shown to customer. Example: "1027" (without #)'),
  limit: z.number()
    .optional()
    .describe('Maximum results to return. Default: 10, Max: 100')
})
```

### Schema Patterns

```javascript
// Optional with default behavior
field: z.string().optional().describe('Optional field. Defaults to "value" if omitted')

// Enum for fixed choices
status: z.enum(['active', 'inactive', 'pending'])
  .describe('Filter by status')

// Nullable vs Optional
// .optional() = field can be omitted
// .nullable() = field can be null
email: z.string().nullable().describe('Email or null for guest')

// Nested objects
filters: z.object({
  dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
  status: z.string().optional().describe('Status filter')
}).optional().describe('Optional query filters')

// Arrays
tags: z.array(z.string()).describe('List of tags to filter by')
```

---

## Error Handling

**Critical Rule:** Return error strings instead of throwing errors. This allows the LLM to decide how to handle the error.

```javascript
// BAD: Throwing stops agent execution
func: async ({orderId}) => {
  const order = await getOrder(orderId);
  if (!order) {
    throw new Error('Order not found');  // Agent stops!
  }
  return formatOrder(order);
}

// GOOD: Return error as string
func: async ({orderId}) => {
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return `Order ${orderId} was not found. Please verify the order ID.`;
    }
    return formatOrder(order);
  } catch (error) {
    // Handle specific error types
    if (error.response?.status === 404) {
      return `Order ${orderId} not found in your store.`;
    }
    if (error.response?.status === 403) {
      return `Access denied to order ${orderId}. Check permissions.`;
    }
    console.error('Order lookup error:', error);
    return `Error looking up order: ${error.message}`;
  }
}
```

### When to Throw

Only throw for truly unrecoverable errors that should halt the agent:

```javascript
func: async (args, runManager, config) => {
  const {shopId} = config.metadata;

  // Throw for missing required context
  if (!shopId) {
    throw new Error('Shop ID is required in config.metadata');
  }

  // Return string for user-facing errors
  const shop = await getShop(shopId);
  if (!shop) {
    return 'Shop not found. Please contact support.';
  }

  // Continue with normal logic...
}
```

---

## Accessing Config and Metadata

The third parameter `config` contains metadata passed during graph invocation:

```javascript
func: async ({param}, runManager, config) => {
  // Access metadata
  const metadata = config.metadata;
  const {shopId, userId, channel} = metadata;

  // Access configurable (thread_id, etc.)
  const threadId = config.configurable?.thread_id;

  // Use in tool logic
  const shop = await getShopById(shopId);
  // ...
}
```

### Passing Metadata

```javascript
// When invoking the graph
const result = await app.invoke(
  {messages: [...]},
  {
    configurable: {thread_id: conversationId},
    metadata: {
      shopId: 'shop_123',
      userId: 'user_456',
      channel: 'web'
    }
  }
);
```

---

## Tool Response Formatting

Format responses for LLM readability:

```javascript
// Formatting helper
function formatOrderItem(order) {
  return `
Order #${order.order_number}:
- ID: ${order.id}
- Created: ${new Date(order.created_at).toLocaleDateString()}
- Total: $${order.total_price}
- Status: ${order.financial_status}
- Customer: ${order.customer?.email || 'Guest'}`;
}

function formatOrdersResponse(data) {
  if (!data) return 'No orders found';
  if (Array.isArray(data)) {
    return `Found ${data.length} orders:\n${data.map(formatOrderItem).join('\n')}`;
  }
  return formatOrderItem(data);
}

// In tool
func: async ({orderId}) => {
  const order = await shopify.order.get(orderId);
  return formatOrdersResponse(order);
}
```

---

## ToolNode Integration

`ToolNode` from LangGraph prebuilt automatically executes tools:

```javascript
import {ToolNode} from '@langchain/langgraph/prebuilt';

const tools = [orderTool, customerTool, productTool];
const toolNode = new ToolNode(tools);

// In graph
workflow
  .addNode('tools', toolNode)
  .addEdge('tools', 'agent');
```

### How ToolNode Works

1. Receives AIMessage with `tool_calls`
2. Matches tool by name
3. Validates args against schema
4. Executes tool function
5. Returns ToolMessage with result

---

## bindTools Usage

Bind tools to a model to enable tool calling:

```javascript
import {ChatOpenAI} from '@langchain/openai';

const model = new ChatOpenAI({model: 'gpt-4o'});
const tools = [orderTool, customerTool];

// Bind tools to model
const boundModel = model.bindTools(tools);

// Model can now return tool_calls
const response = await boundModel.invoke([
  {role: 'user', content: 'Look up order #1234'}
]);

// response.tool_calls = [{name: 'get_order', args: {...}}]
```

### Dynamic Tool Binding

```javascript
// Bind different tools based on context
async function agentNode(state) {
  const relevantTools = filterTools(state.messages, allTools);
  const boundModel = model.bindTools(relevantTools);
  const response = await boundModel.invoke(state.messages);
  return {messages: [response]};
}
```

---

## Zod Warnings Suppression

OpenAI's tool calling generates warnings for optional fields. Suppress them:

```javascript
import {z} from 'zod';

// Suppress Zod warnings for OpenAI API compatibility
z.setErrorMap((issue, ctx) => {
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return {message: ''};
  }
  return {message: ctx.defaultError};
});

// Suppress console warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  if (typeof message === 'string' &&
      (message.includes('Zod field') ||
       message.includes('.optional() without .nullable()') ||
       message.includes('This will become an error'))) {
    return;
  }
  originalWarn.apply(console, args);
};
```

---

## Complete Examples

### Basic Tool

```javascript
import {DynamicStructuredTool} from '@langchain/core/tools';
import {z} from 'zod';

export const getWeatherTool = new DynamicStructuredTool({
  name: 'get_weather',
  description: 'Get current weather for a location. Use when user asks about weather.',
  schema: z.object({
    city: z.string().describe('City name. Example: "New York"'),
    country: z.string().optional().describe('Country code. Example: "US"')
  }),
  func: async ({city, country}) => {
    try {
      const weather = await weatherApi.get(city, country);
      return `Weather in ${city}: ${weather.temp}°F, ${weather.conditions}`;
    } catch (error) {
      return `Could not get weather for ${city}: ${error.message}`;
    }
  }
});
```

### Tool with Metadata Access

```javascript
export const getOrderTool = new DynamicStructuredTool({
  name: 'shopify_get_order',
  description: 'Fetch a Shopify order by ID or order number.',
  schema: z.object({
    orderId: z.string().optional()
      .describe('Shopify order ID. Example: "6552244224222"'),
    orderName: z.string().optional()
      .describe('Order number. Example: "1027" (without #)')
  }),
  func: async ({orderId, orderName}, runManager, config) => {
    try {
      const {shopId} = config.metadata;
      if (!shopId) throw new Error('Shop ID required');

      const shop = await getShopById(shopId);
      const shopify = initShopify(shop);

      let order;
      if (orderId) {
        order = await shopify.order.get(parseInt(orderId));
      } else if (orderName) {
        const results = await shopify.order.list({name: `#${orderName}`});
        order = results[0];
      }

      if (!order) {
        return `Order not found. Please verify the order ID or number.`;
      }

      return formatOrderResponse(order);
    } catch (error) {
      if (error.response?.status === 404) {
        return `Order not found in your store.`;
      }
      console.error('Order lookup error:', error);
      return `Error fetching order: ${error.message}`;
    }
  }
});
```

### Tool with Complex Schema

```javascript
export const searchActivitiesTool = new DynamicStructuredTool({
  name: 'search_activities',
  description: 'Search customer loyalty activities and point history.',
  schema: z.object({
    customerEmail: z.string().optional()
      .describe('Customer email to filter by'),
    activityType: z.enum(['earn', 'redeem', 'referral', 'all']).optional()
      .describe('Type of activity. Default: "all"'),
    filters: z.object({
      dateFrom: z.string().optional()
        .describe('Start date (YYYY-MM-DD)'),
      dateTo: z.string().optional()
        .describe('End date (YYYY-MM-DD)'),
      minPoints: z.number().optional()
        .describe('Minimum points amount'),
      maxPoints: z.number().optional()
        .describe('Maximum points amount')
    }).optional().describe('Additional filters'),
    limit: z.number().optional()
      .describe('Max results. Default: 20, Max: 100')
  }),
  func: async ({customerEmail, activityType = 'all', filters = {}, limit = 20}, rm, config) => {
    try {
      const {shopId} = config.metadata;

      const query = {
        shopId,
        ...(customerEmail && {email: customerEmail}),
        ...(activityType !== 'all' && {type: activityType}),
        ...filters,
        limit: Math.min(limit, 100)
      };

      const activities = await activityRepository.search(query);

      if (activities.length === 0) {
        return 'No activities found matching your criteria.';
      }

      return formatActivitiesResponse(activities);
    } catch (error) {
      console.error('Activity search error:', error);
      return `Error searching activities: ${error.message}`;
    }
  }
});
```