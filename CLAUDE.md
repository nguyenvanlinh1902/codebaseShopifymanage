# CLAUDE.md

This file provides guidance to Claude Code when working with this Avada Shopify application.

## Tech Stack

- **Backend**: Node.js, Firebase Functions, Firestore
- **Frontend**: React, Shopify Polaris v12+
- **APIs**: Shopify GraphQL Admin API, Shopify REST API
- **Extensions**: Checkout UI, Customer Account, Theme App Extensions

## Project Structure

```
packages/
├── functions/src/        # Backend (Firebase Functions)
│   ├── config/           # Configuration and environment
│   ├── const/            # Constants grouped by domain
│   ├── handlers/         # Controllers - orchestrate ONLY, no business logic
│   ├── services/         # Business logic, combine multiple repos
│   ├── repositories/     # CRUD for ONE Firestore collection - NEVER mix
│   ├── helpers/          # Small single-purpose utilities
│   ├── presenters/       # Map/format output data
│   └── routes/           # API route definitions
├── assets/src/           # Frontend (React)
│   ├── components/       # Reusable components (PascalCase)
│   ├── pages/            # Page components
│   ├── hooks/            # Custom hooks (useFetchApi, useCreateApi)
│   ├── contexts/         # React contexts
│   └── helpers/          # Utilities
extensions/               # Shopify extensions
```

## Key Architecture Rules

### Backend
- **Handlers** only orchestrate; NO heavy business logic
- **Services** contain business logic; combine multiple repos
- **Repositories** handle ONE Firestore collection each - NEVER mix collections
- Response format: `{success: true/false, data: {...}, error: "message"}`

### Frontend
- One component per file (PascalCase filename)
- Functional components only
- BEM naming for CSS classes
- Use Shopify Polaris components
- `url` prop for navigation (NOT `onClick` + `window.open`)

### Firestore
- Batch operations max 500 per batch
- Check emptiness with `docs.empty` (not size/length)
- Filter early with `where`, select only needed fields
- Use aggregates for count/sum/avg

### Shopify
- Prefer GraphQL Admin API over REST
- Verify webhook HMAC signatures
- Handle rate limits with exponential backoff

## Available Commands

| Command | Description |
|---------|-------------|
| `/plan [task]` | Create implementation plan |
| `/fix [issue]` | Analyze and fix issues |
| `/test` | Run tests and validate |
| `/debug [issue]` | Investigate problems |
| `/review` | Code review with Avada standards |
| `/security` | Security audit |
| `/impact` | MR impact analysis |

## Available Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `planner` | Research and create implementation plans | sonnet |
| `debugger` | Investigate issues, analyze logs | sonnet |
| `tester` | Run tests, validate quality | haiku |
| `code-reviewer` | Comprehensive code review | - |
| `security-auditor` | Security vulnerability analysis | sonnet |
| `shopify-app-tester` | MR impact and testing checklist | sonnet |

## Shopify MCP Tools

Use for Shopify API work:
- `learn_shopify_api` - Learn about Shopify APIs (call first!)
- `introspect_graphql_schema` - Explore GraphQL schema
- `search_docs_chunks` - Search Shopify documentation
- `validate_graphql_codeblocks` - Validate GraphQL queries

## Common Workflows

### New Feature
1. `/plan [feature]` - Create implementation plan
2. Implement following the plan
3. `/test` - Validate implementation
4. `/review` - Code review
5. `/impact` - Generate test checklist

### Bug Fix
1. `/debug [issue]` - Investigate root cause
2. `/fix [issue]` - Implement fix
3. `/test` - Verify fix

### Before Merge
1. `/test` - Ensure tests pass
2. `/review` - Code review
3. `/security` - Security check (for sensitive changes)
4. `/impact` - Generate testing checklist
