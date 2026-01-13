---
name: api-design
description: Use this skill when the user asks to "create an API endpoint", "build a REST API", "add a controller", "design an API", "implement CRUD operations", "add validation", "handle API errors", or any backend API development work. Provides REST API design patterns, response formats, validation, and best practices.
---

# REST API Design (packages/functions)

> For **security patterns**, see `security` skill

## Quick Reference

| Topic | Reference File |
|-------|---------------|
| Response Helpers, Status Codes, Error Codes | [references/response-format.md](references/response-format.md) |
| Storefront Endpoints, Shop Resolution, PII | [references/client-api.md](references/client-api.md) |
| Yup Schemas, Validation Middleware | [references/validation.md](references/validation.md) |

---

## CRITICAL: Firebase/Koa Context

```javascript
// WRONG - Standard Koa (does NOT work in Firebase)
const data = ctx.request.body;

// CORRECT - Firebase/Koa
const data = ctx.req.body;
```

| Property | Access Pattern |
|----------|----------------|
| Request body | `ctx.req.body` |
| Query params | `ctx.query` |
| URL params | `ctx.params` |
| Response body | `ctx.body = {...}` |

---

## Directory Structure

```
packages/functions/src/
├── routes/              # Route definitions
├── controllers/         # Request handlers
├── middleware/          # Auth, validation
└── validations/         # Yup schemas
```

---

## RESTful Conventions

| Action | Method | Route |
|--------|--------|-------|
| List | GET | `/resources` |
| Get one | GET | `/resources/:id` |
| Create | POST | `/resources` |
| Update | PUT | `/resources/:id` |
| Delete | DELETE | `/resources/:id` |
| Action | POST | `/resources/:id/action` |

---

## Controller Pattern

```javascript
export async function getOne(ctx) {
  try {
    const {shop} = ctx.state;
    const {id} = ctx.params;

    const resource = await repository.getById(shop.id, id);

    if (!resource) {
      ctx.status = 404;
      ctx.body = errorResponse('Not found', 'NOT_FOUND', 404);
      return;
    }

    ctx.body = itemResponse(pick(resource, publicFields));
  } catch (error) {
    console.error('Error:', error);
    ctx.status = 500;
    ctx.body = errorResponse('Server error', 'INTERNAL_ERROR', 500);
  }
}
```

---

## Pagination (Cursor-Based)

```javascript
// Request
GET /api/customers?limit=20&cursor=eyJpZCI6IjEyMyJ9

// Response
{
  "data": [...],
  "meta": {
    "pagination": {
      "hasNext": true,
      "nextCursor": "eyJpZCI6IjE0MyJ9",
      "limit": 20
    }
  }
}
```

---

## Checklist

```
- Uses response helpers (successResponse/errorResponse)
- Correct HTTP status codes
- Input validated with Yup schema
- Queries scoped by shopId
- Response fields picked (no internal data)
- Error handling with try-catch
- Rate limiting applied
- Authentication middleware
```
