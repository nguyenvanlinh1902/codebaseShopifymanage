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
├── assets/src/           # Frontend (React)
│   ├── components/       # Reusable components
│   ├── pages/            # Page components
│   └── hooks/            # Custom hooks
extensions/               # Shopify extensions
```

## Skills (Reference Documentation)

| Skill | Use For |
|-------|---------|
| `.claude/skills/avada-architecture.md` | Project structure, patterns, coding standards |
| `.claude/skills/firestore.md` | Queries, batching, TTL, indexes |
| `.claude/skills/bigquery.md` | Partitioning, clustering, cost control |
| `.claude/skills/shopify-api.md` | API selection, bulk ops, webhooks |
| `.claude/skills/backend.md` | Async patterns, functions config, webhooks |

## Commands

| Command | Description |
|---------|-------------|
| `/plan [task]` | Create implementation plan |
| `/fix [issue]` | Analyze and fix issues |
| `/test` | Run tests and validate |
| `/debug [issue]` | Investigate problems |
| `/review` | Code review |
| `/security` | Security audit |
| `/perf [target]` | Performance audit |
| `/impact` | MR impact analysis |

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

### Code Style
- **Early return** - avoid else/else-if, use guard clauses
- **Small functions** - single responsibility, one function does one thing
- **JSDoc** - required for public service/handler functions
- **TypeDefs** - centralize types in `functions.d.ts`

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

## Workflows

### New Feature
```
/plan [feature] → implement → /test → /review → /impact
```

### Bug Fix
```
/debug [issue] → /fix → /test
```

### Before Merge
```
/test → /review → /perf → /impact
```
