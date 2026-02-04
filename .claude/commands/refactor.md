# Refactor Code

Refactor the specified file or code pattern following Avada Development standards.

## Arguments
- `$ARGUMENTS` - File path, function name, or refactoring scope (e.g., "magic strings in services", "src/services/userService.js", "consolidate duplicate code in handlers")

## Reference Skills
- `.claude/skills/avada-architecture.md`
- `.claude/skills/backend.md`

## Refactoring Checklist

### Code Quality
- [ ] Extract magic strings/numbers to named constants
- [ ] Replace hardcoded values with configuration or environment variables
- [ ] Apply early return pattern (eliminate else/else-if chains)
- [ ] Replace switch/if-else chains (3+ branches) with handler maps
- [ ] Prefer `map/filter/reduce` over `for` loops for data transformation
- [ ] Break large functions into smaller, single-responsibility functions
- [ ] Use descriptive variable/function names (verbs for functions, nouns for variables)
- [ ] Apply proper naming conventions (camelCase, PascalCase, UPPER_SNAKE_CASE)

### DRY (Don't Repeat Yourself)
- [ ] Identify and consolidate duplicate code into reusable functions
- [ ] Extract common patterns into helper utilities
- [ ] Create shared constants for repeated values
- [ ] Consider creating base classes or mixins for shared behavior

### Architecture Patterns
- [ ] Ensure handlers only orchestrate (no business logic)
- [ ] Move business logic to services (uniqueness checks, cross-entity rules)
- [ ] Extract schema validation to Zod middleware (`middleware/{feature}Validation.js`)
- [ ] Keep repositories focused on single collection
- [ ] Repository functions require `shopId` as first parameter (multi-tenant)
- [ ] Define collection name inline in repository (`const COLLECTION_NAME = '...'`)
- [ ] Store GraphQL queries as named constants at module top level
- [ ] Extract result mapper functions for API response transformation
- [ ] Separate concerns appropriately

### Performance Considerations
- [ ] Use `Promise.all` for independent async operations
- [ ] Avoid N+1 query patterns
- [ ] Consider caching for repeated operations
- [ ] Use early exits to avoid unnecessary processing

### Type Safety
- [ ] Add/update JSDoc comments for public functions
- [ ] Update TypeScript definitions in `index.d.ts` if needed
- [ ] Use proper type annotations

## Output Format

1. **Analysis**: Identify issues in current code
2. **Refactoring Plan**: List specific changes to make
3. **Implementation**: Apply refactoring changes
4. **Verification**: Ensure no functionality was broken

## Examples

### Extract Magic Strings
```javascript
// BEFORE
if (status === 'active') { ... }
if (type === 'percentage') { ... }

// AFTER
import { STATUS, TYPE } from '@functions/const/feature';

if (status === STATUS.ACTIVE) { ... }
if (type === TYPE.PERCENTAGE) { ... }
```

### Apply Early Return
```javascript
// BEFORE
function process(data) {
  if (data) {
    if (data.isValid) {
      return doSomething(data);
    } else {
      return {error: 'Invalid'};
    }
  } else {
    return {error: 'No data'};
  }
}

// AFTER
function process(data) {
  if (!data) {
    return {error: 'No data'};
  }
  if (!data.isValid) {
    return {error: 'Invalid'};
  }
  return doSomething(data);
}
```

### Extract Reusable Function
```javascript
// BEFORE - Duplicated in multiple files
const numericId = gid.replace(/.*\//, '');

// AFTER - Extracted to helper
// helpers/utils.js
export function extractNumericId(gid) {
  return gid.replace(/.*\//, '');
}
```

### Shared Constants Pattern
Place constants in `packages/functions/src/const/` for sharing between backend and frontend.

**Important**: Assets can import from functions, but NOT the other way around.

**Split files for bundle optimization** (critical for scripttag):
```
packages/functions/src/const/{feature}/
├── index.js          # Barrel file - re-exports all
├── status.js         # Lightweight enums (scripttag-safe)
├── widget.js         # Default settings (scripttag-safe)
├── validation.js     # Validation limits (backend)
└── metafield.js      # Metafield configs (backend)
```

**Note**: Collection names stay inline in repositories, not extracted to constants.

### Replace Switch/Else-If with Handler Map
```javascript
// BEFORE - switch/if-else chain
function handleAction(actionType, params) {
  if (actionType === 'discount_create') {
    return executeDiscountCreate(params);
  } else if (actionType === 'customer_add_tags') {
    return executeAddTags(params);
  } else if (actionType === 'order_cancel') {
    return executeCancelOrder(params);
  }
}

// AFTER - data-driven handler map
const ACTION_HANDLERS = {
  discount_create: ({shop, params}) => executeDiscountCreate(shop, params),
  customer_add_tags: ({shop, params}) => executeAddTags(shop, params),
  order_cancel: ({shop, params}) => executeCancelOrder(shop, params)
};

function handleAction(actionType, context) {
  const handler = ACTION_HANDLERS[actionType];
  if (!handler) return {success: false, error: `Unknown action: ${actionType}`};
  return handler(context);
}
```

### Extract Service Layer from Controller
```javascript
// BEFORE - validation + business logic in controller
export async function createSkill(ctx) {
  const {command} = ctx.req.body;
  if (RESERVED_COMMANDS.includes(command)) {
    ctx.status = 400;
    ctx.body = {error: 'Reserved command'};
    return;
  }
  const isTaken = await repo.isCommandTaken({command, shopId});
  if (isTaken) { ... }
  const skill = await repo.createCustomSkill({shopId, ...});
  ctx.body = {data: skill};
}

// AFTER - service handles logic, controller orchestrates
// services/customSkillService.js
export async function createSkill(shopId, {command, ...params}) {
  const validation = await validateCommand(command, shopId);
  if (!validation.valid) return {success: false, error: validation.error};
  const skill = await repo.createCustomSkill({shopId, command, ...params});
  return {success: true, data: skill};
}

// controllers/customSkillController.js
export async function createSkill(ctx) {
  const result = await skillService.createSkill(shopId, ctx.req.body);
  if (!result.success) ctx.status = 400;
  ctx.body = result;
}
```

### GraphQL Queries as Named Constants with Mappers
```javascript
// BEFORE - inline query + inline transformation
export async function searchProducts(shopData, q) {
  const result = await executeGraphQLQuery(shopData, `query { products(...) { edges { node { id title } } } }`, ...);
  return result.data.products.edges.map(e => ({
    id: e.node.id.replace('gid://shopify/Product/', ''),
    title: e.node.title
  }));
}

// AFTER - named constant + mapper function
const PRODUCT_SEARCH_QUERY = `
  query searchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges { node { id title handle status } }
    }
  }
`;

function mapProduct(node) {
  return { id: extractId(node.id, 'Product'), title: node.title, handle: node.handle };
}

export async function searchProducts(shopData, q, limit) {
  const result = await executeGraphQLQuery(shopData, PRODUCT_SEARCH_QUERY, undefined, {query: q, first: limit});
  if (!result.success) return {success: false, error: result.error};
  return {success: true, data: result.data.products.edges.map(e => mapProduct(e.node))};
}
```

**Import patterns**:
```javascript
// Backend - import from barrel
import { STATUS, VALIDATION, METAFIELD } from '@functions/const/feature';

// Frontend admin - import from barrel
import { STATUS, DEFAULT_SETTINGS } from '@functions/const/feature';

// Scripttag - import specific file for minimal bundle
import { DEFAULT_SETTINGS } from '@functions/const/feature/widget';
```

**Barrel file** (`index.js`):
```javascript
// Scripttag-safe (lightweight)
export { STATUS, TYPE } from './status';
export { DEFAULT_SETTINGS } from './widget';

// Backend-only
export { VALIDATION } from './validation';
export { METAFIELD } from './metafield';
```

Now analyze and refactor: $ARGUMENTS
