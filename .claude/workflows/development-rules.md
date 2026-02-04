# Avada Development Rules

## Principles
**YAGNI** - You Aren't Gonna Need It
**KISS** - Keep It Simple, Stupid
**DRY** - Don't Repeat Yourself

## Code Standards

### Naming Conventions
- `camelCase` - variables, functions, properties
- `PascalCase` - classes, React components
- `UPPER_SNAKE_CASE` - constants
- Functions start with verbs: `getUserData`, `calculatePoints`
- Booleans prefix with `is/has`: `isActive`, `hasPermission`

### Code Patterns
- Prefer `const` over `let`; avoid mutation
- Use `===` instead of `==`
- Prefer async/await over promises
- Prefer `map/filter/reduce` over `for` loops for data transformation
- Functions with >3 params use object destructuring
- Use early return pattern; minimize `else`
- Single responsibility: one function does one thing
- **Data-driven conditionals**: Replace `switch`/`if-else` chains with object map lookups (see below)

### Data-Driven Conditionals (Maps vs Switch/Else-If)
When you have 3+ conditions routing to different behavior, use an object map instead of switch or if-else chains:

```javascript
// BAD: if-else chain
if (type === 'customer') { handleCustomer(); }
else if (type === 'order') { handleOrder(); }
else if (type === 'product') { handleProduct(); }

// GOOD: Handler map
const HANDLERS = {
  customer: handleCustomer,
  order: handleOrder,
  product: handleProduct
};
const handler = HANDLERS[type];
if (handler) handler();
```

**When to use maps:**
- 3+ branches mapping type/action → behavior
- Switch/case with same structure per case
- Suggestion/config generation per entity type
- HITL action routing, status formatting, error messages

**When NOT to use maps:** 2 branches (ternary is fine), complex conditions that aren't simple key lookups.

### Validation Strategy (Two Layers)

Validation is split into **middleware** and **service**:

1. **Middleware (Zod or Yup)** — Schema validation: types, formats, lengths, required fields. Runs before the controller. Rejects malformed input with 400.
2. **Service** — Business validation: uniqueness checks, reserved values, cross-entity rules. Requires DB lookups.

```
Request → [Schema Middleware] → Controller → [Service Validation] → Repository
             ↑ 400                             ↑ {success: false}
```

- Define schemas in `middleware/{feature}Validation.js`
- Use generic `validate(schema)` factory to create middleware
- Wire middleware in routes: `router.post('/skills', validateCreate, controller.create)`
- Schema middleware replaces body with parsed/trimmed data — no need for manual sanitization in controllers
- Reference: `.claude/skills/api-design/references/validation.md`

### Service Layer Extraction
Move business logic from controllers/handlers to services when:
- Controller has validation logic beyond basic input presence checks
- Controller queries repositories directly with business conditions
- Controller builds/transforms data beyond simple pass-through
- Same logic is needed in multiple controllers

```javascript
// BAD: Business logic in controller
export async function createSkill(ctx) {
  if (RESERVED_COMMANDS.includes(command)) { ... }
  const isTaken = await repo.isCommandTaken({command, shopId});
  if (isTaken) { ... }
  const skill = await repo.createCustomSkill({...});
  ctx.body = {data: skill};
}

// GOOD: Zod middleware validates schema, controller orchestrates, service handles business logic
export async function createSkill(ctx) {
  const result = await skillService.createSkill(shopId, ctx.req.body);
  if (!result.success) ctx.status = 400;
  ctx.body = result;
}
```

### GraphQL Query Organization
- Store GraphQL queries as **named constants** at module top level
- Name pattern: `RESOURCE_ACTION_QUERY` (e.g., `PRODUCT_SEARCH_QUERY`, `ORDER_LIST_QUERY`)
- Use **mapper functions** to transform GraphQL responses to domain objects
- Extract GID parsing to helper: `extractId(gid, 'Product')`

```javascript
// Named queries at module top
const PRODUCT_SEARCH_QUERY = `query searchProducts($query: String!, $first: Int!) { ... }`;

// Mapper function
function mapProduct(node) {
  return { id: extractId(node.id, 'Product'), title: node.title, ... };
}

// Service function uses both
export async function searchProducts(shopData, q, limit) {
  const result = await executeGraphQLQuery(shopData, PRODUCT_SEARCH_QUERY, undefined, {...});
  return { success: true, data: result.data.products.edges.map(e => mapProduct(e.node)) };
}
```

### Backend Structure (Node.js/Firebase)
```
packages/functions/src/
├── handlers/      # Controllers - orchestrate ONLY, no business logic
├── services/      # Business logic, combine multiple repos
├── repositories/  # ONE Firestore collection per repo - NEVER mix
├── helpers/       # Small single-purpose utilities
├── presenters/    # Format output data
├── const/         # Constants grouped by domain (see Constants Rules)
└── config/        # Configuration
```

### Constants Organization
- Group constants by feature in `const/{feature}/` directory
- **Split by bundle target**: scripttag-safe (lightweight) vs backend-only (heavier)
- Use barrel file `index.js` for convenient imports
- Keep collection names inline in repositories (not extracted)
- Example structure:
  ```
  const/featureName/
  ├── index.js      # Barrel file re-exporting all
  ├── settings.js   # Default settings, enums (SCRIPTTAG-SAFE - keep lightweight)
  └── config.js     # TTL, API config, fallbacks (BACKEND-ONLY)
  ```
- **Scripttag imports**: Use direct path `@functions/const/feature/settings` (not barrel)
- **Backend/Admin imports**: Use barrel `@functions/const/feature`

### Frontend Structure (React)
- One component per file (PascalCase filename)
- Functional components only
- BEM naming for CSS classes
- Use React Context to avoid prop drilling
- Custom hooks for reusable logic

## Firestore Rules
- Repository handles ONE collection only
- Define collection name as `const COLLECTION_NAME = '...'` inline in repository
- All query/mutation functions require `shopId` as first parameter (multi-tenant)
- Use batch operations (max 500 per batch)
- Check emptiness with `docs.empty` (not size/length)
- Use Firestore aggregates for count/sum/avg
- Filter early with `where`, select only needed fields
- **INDEXES**: Create `firestore-indexes/{collection}.json` for compound queries, run `yarn firestore:build`

## Shopify/Polaris Rules
- Use GraphQL Admin API (preferred over REST)
- Button `url` prop for navigation (NOT `onClick` + `window.open`)
- Use Polaris components when available
- Verify webhook HMAC signatures
- Handle rate limits with exponential backoff

## Development Environment
- `yarn dev` auto-syncs cloudflare tunnel URL to all packages:
  - `packages/functions/.env` (APP_BASE_URL)
  - `packages/scripttag/.env.development` (API_URL)
  - `extensions/theme-extension/assets/` (BASE_URL)
- No manual env updates needed during development

## Security
- NEVER commit credentials or API keys
- Validate `.gitignore` includes secrets
- Sanitize all user inputs
- Parameterize database queries
- Verify authentication on all endpoints

## Pre-commit
- Run `npm run lint` before commit
- Run `npm test` before push
- NEVER ignore failing tests
- Use conventional commit messages
- Keep commits focused and atomic

## File Size
- Keep files under 200 lines when possible
- Split large files into focused modules
- Extract utilities into separate files

## AI/LangChain Rules

### Multi-Agent Architecture
- **NEVER** combine 50+ tools into a single agent - LLM won't call tools reliably
- Split into specialist agents with **5-15 tools each** by domain
- Use supervisor pattern to route to specialists
- Reference: `.claude/skills/langchain/references/multi-agent-architecture.md`

### Agent Configuration
- Use `temperature: 0` for specialist agents (reliable tool calling)
- Use `temperature: 0.3` for supervisor (routing decisions)
- Agent prompts MUST list tools explicitly with examples
- Include "CALL the tool, don't describe the action" instruction

### Tool Design
- Tool descriptions must be clear with example inputs
- HITL tools return `{pending: true, actionType, actionId}` for confirmation
- Use `interrupt()` inside tools for human-in-the-loop confirmation
- Execute tools are separate from confirmation tools (two-step HITL)
