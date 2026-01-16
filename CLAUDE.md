# CLAUDE.md

This file provides guidance to Claude Code when working with this Avada Shopify application.

## Tech Stack

- **Backend**: Node.js, Firebase Functions, Firestore
- **Frontend**: React, Shopify Polaris v12+
- **APIs**: Shopify GraphQL Admin API, Shopify REST API
- **Analytics**: BigQuery
- **Extensions**: Checkout UI, Customer Account, Theme App Extensions

## Project Structure

```
packages/
├── functions/src/        # Backend (Firebase Functions)
│   ├── handlers/         # Controllers - orchestrate ONLY
│   ├── services/         # Business logic
│   ├── repositories/     # ONE collection per repo
│   ├── helpers/          # Utilities
│   └── presenters/       # Output formatting
├── assets/src/           # Frontend (React/Polaris)
│   ├── components/       # Reusable components
│   ├── pages/            # Page components
│   └── hooks/            # Custom hooks
├── scripttag/src/        # Storefront widget (Preact, lightweight)
extensions/
└── theme-extension/      # Theme App Extension (Liquid blocks)
firestore-indexes/        # Compound query indexes (run yarn firestore:build)
```

## Skills (Reference Documentation)

| Skill | Use For |
|-------|---------|
| `.claude/skills/backend/` | Async patterns, Firebase functions, Pub/Sub, webhooks |
| `.claude/skills/frontend/` | React/Polaris admin app patterns |
| `.claude/skills/firestore/` | Queries, batching, TTL, indexes |
| `.claude/skills/bigquery/` | Partitioning, clustering, cost control |
| `.claude/skills/shopify-api/` | API selection, rate limits, webhooks |
| `.claude/skills/shopify-bulk-operations/` | Bulk mutations, JSONL, staged uploads |
| `.claude/skills/shopify-functions/` | Shopify Functions (discounts, validation) |
| `.claude/skills/scripttag/` | Storefront widget (Preact, lightweight) |
| `.claude/skills/theme-extension/` | Theme App Extension (Liquid blocks) |
| `.claude/skills/storefront-data/` | Storefront data layer patterns |
| `.claude/skills/polaris/` | Polaris v12+ component patterns |
| `.claude/skills/api-design/` | REST API design, validation, responses |
| `.claude/skills/redis-caching/` | Redis caching, TTL, circuit breaker |
| `.claude/skills/cloud-tasks/` | Cloud Tasks background processing |
| `.claude/skills/security/` | Auth, IDOR prevention, webhook verification |
| `.claude/skills/shopify-testing/` | Browser testing with Playwright MCP |

## Commands

| Command | Description |
|---------|-------------|
| `/plan [task]` | Create implementation plan |
| `/fix [issue]` | Analyze and fix issues |
| `/test` | Run tests and validate |
| `/debug [issue]` | Investigate problems |
| `/review` | Code review |
| `/refactor [target]` | Refactor code (extract constants, DRY, early returns) |
| `/security` | Security audit |
| `/perf [target]` | Performance audit |
| `/impact` | MR impact analysis |
| `/label` | Check labels for Polaris content guidelines |
| `/translate` | Update translations after adding labels |
| `/lint-mr` | ESLint fix files changed in current MR |
| `/browser-test [target]` | Test app in browser (admin, storefront, theme, checkout, cart) |
| `/test-checklist` | Generate grey box testing checklist from current MR/branch |
| `/commit` | Generate commit message and commit all changes |
| `/typedoc` | Update JSDoc comments and TypeScript types in index.d.ts |
| `/docs [feature]` | Document feature changes and updates |
| `/learn-from-mr [area]` | Analyze MR to extract patterns and update `.claude/` skills/rules |

## Agents

| Agent | Purpose |
|-------|---------|
| `planner` | Research and create implementation plans |
| `debugger` | Investigate issues, analyze logs |
| `tester` | Run tests, validate quality |
| `performance-reviewer` | Audit performance, costs, efficiency |
| `code-reviewer` | Code review with Avada standards |
| `security-auditor` | Security vulnerability analysis |
| `shopify-app-tester` | MR impact and testing checklist |

## Key Rules

### Backend
- **Handlers** orchestrate only - no business logic
- **Services** contain business logic
- **Repositories** handle ONE Firestore collection each
- Response format: `{success, data, error}`
- Use `Promise.all` for parallel operations
- **Request body**: Use `ctx.req.body` (NOT `ctx.request.body`) - Firebase Functions pre-parses the body

### Code Style
- **Early return** - avoid else/else-if, use guard clauses
- **Small functions** - single responsibility, one function does one thing
- **JSDoc** - required for public service/handler functions
- **TypeDefs** - centralize types in `packages/functions/index.d.ts`

### Firestore
- Always scope queries by `shopId` (multi-tenant)
- Batch operations max 500 per batch
- Use TTL for logs/temp collections
- Check indexes for compound queries

### Webhooks
- Must respond within **5 seconds**
- Queue heavy processing to background

### Shopify
- Prefer GraphQL Admin API
- Use bulk operations for 500+ items
- Use App Bridge direct API when no Firestore needed

### BigQuery
- Tables >1GB need partitioning
- Always include partition filter in queries
- Cluster by frequently filtered columns

## Development & Debugging

### Running the App
The app runs with two separate terminal processes:
- `sudo yarn dev` - Frontend dev server
- `yarn emulators` - Firebase emulators (backend)

### Backend Logs
When debugging backend issues, check:
- **`firebase-debug.log`** - Main log file for Firebase emulators (functions, hosting, firestore)
- Contains: function executions, HTTP requests/responses, errors, warnings
- Search for errors: `grep -i "error\|warn" firebase-debug.log`
- View recent logs: `tail -100 firebase-debug.log`

### Testing the App
To test the app, use these URLs (read from `shopify.app.toml`):

**Embedded App (Shopify Admin):**
- **URL pattern**: `https://admin.shopify.com/store/{store}/apps/{app-handle}/embed`
- **Store**: Extract from `dev_store_url` (e.g., `thomas-joy-klaviyo-prod.myshopify.com` → `thomas-joy-klaviyo-prod`)
- **App handle**: Convert `name` to kebab-case (e.g., `thomas app base template` → `thomas-app-base-template`)
- **Example**: `https://admin.shopify.com/store/thomas-joy-klaviyo-prod/apps/thomas-app-base-template/embed`

**Frontend Dev Server (Vite):**
- **URL**: The cloudflare tunnel URL from `yarn dev` output (e.g., `https://jacob-smart-ear-oliver.trycloudflare.com`)
- **How to find**: Check terminal output when running `yarn dev`, or look at Shopify Admin Dev Console panel
- **Direct access**: `https://{tunnel-url}/embed` for embed app, `https://{tunnel-url}/` for standalone

**Storefront (Customer-facing):**
- **URL pattern**: `https://{dev_store_url}` from `shopify.app.toml`
- **Example**: `https://thomas-joy-klaviyo-prod.myshopify.com`
- **Theme extension preview**: Available in Dev Console when running `yarn dev`

Use Playwright MCP to open and test the app in browser.

## Workflows

- Primary workflow: `.claude/workflows/primary-workflow.md`
- Development rules: `.claude/workflows/development-rules.md`
- Orchestration protocol: `.claude/workflows/orchestration-protocol.md`
- Documentation management: `.claude/workflows/documentation-management.md`

**IMPORTANT:** You must follow the primary workflow in `.claude/workflows/primary-workflow.md` for all implementation tasks.
**IMPORTANT:** You must follow strictly the development rules in `.claude/workflows/development-rules.md` file.
**IMPORTANT:** Activate relevant skills from `.claude/skills/` based on the task requirements.

### Quick Reference

**New Feature:**
```
/plan → implement → /test → /refactor (optional) → /typedoc → /review → /impact
```

**Bug Fix:**
```
/debug → /fix → /test → /review
```

**Before Merge:**
```
/test → /review → /perf → /impact
```
