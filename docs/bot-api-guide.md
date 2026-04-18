# Bot API Guide

> **Last verified:** 2026-04-18
> **Audience:** paste this entire document into any AI chat (Gemini, Claude, ChatGPT, …) so the model can call this app's API as a specific user.

This guide describes a REST API that exposes Shopify store operations (orders, products, tracking, analytics, email inboxes, etc.). The API accepts a long-lived **bot API key** sent via the `x-api-key` header. The key grants full user-level access — treat it like a password.

---

## 1. Overview

- **Who creates keys:** admins only, via the Bot API Keys admin page (`/bot-api-keys` in the web app).
- **Format:** `bot_<32 hex chars>` — 36 characters total.
- **Storage:** the raw key is shown ONCE at creation and never again. Only its SHA-256 hash is stored.
- **Revocation:** soft — a revoked key immediately returns 401 on all routes.
- **Scope:** the bot acts AS the key's owning user. Existing per-user data scoping applies.

---

## 2. Base URL

Base URL for the `api` Firebase Function looks like:

```
https://<REGION>-<PROJECT>.cloudfunctions.net/api
```

To get the exact URL, run:

```bash
firebase functions:list
```

or read it from Firebase Console → Functions → `api`. Replace `<BASE_URL>` in every example below with that value.

All calls MUST use HTTPS. HTTP is rejected by Cloud Functions.

---

## 3. Authentication

Send exactly one header on every request:

```
x-api-key: bot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Do **not** also send `x-client-id` / `Authorization` — those are for interactive JWT auth only. If you send both, `x-api-key` wins.
- On failure the server replies `401` with JSON `{success:false, error:..., code:...}`.
- On success downstream controllers see `req.userId`, `req.userRole` exactly as they would with a JWT, so every existing route works unchanged.

---

## 4. Rate limit

- **60 requests / minute / key**, enforced by an in-memory sliding-window limiter **per Cloud Functions instance**.
- Effective ceiling therefore = `60 × active_instance_count`. For a cold app this is 60/min; under high autoscale it can be higher.
- When exceeded: HTTP `429` with body `{success:false, error:"Rate limit exceeded", retryAfter:<seconds>}` and a `Retry-After: <seconds>` header.
- **Recommendation:** back off on 429; don't retry tighter than `Retry-After`.

---

## 5. Error codes

| HTTP | When | Body `code` |
|------|------|-------------|
| 400 | malformed payload | — |
| 401 | missing / invalid / revoked / expired key | `INVALID_FORMAT`, `NOT_FOUND`, `INVALID_KEY`, `REVOKED`, `EXPIRED`, `OWNER_MISSING`, `OWNER_INACTIVE` |
| 403 | non-admin hitting `/api/bot-api-keys/*` | — |
| 404 | route does not exist | — |
| 429 | rate-limit | — |
| 5xx | server error | — |

---

## 6. Endpoint reference

> Every route below lives under `<BASE_URL>` and requires the `x-api-key` header. Query parameters documented below are the common ones — see the controller for the full list.

### 6.1 Orders

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/orders` | List orders (filter by `storeId`, `limit`, `cursor`, etc.) |
| POST   | `/api/orders/sync` | Kick off an orders-sync for one or more stores |
| POST   | `/api/orders/schedule` | Schedule a recurring sync |
| GET    | `/api/orders/sync-configs` | List current sync configs |
| GET    | `/api/orders/sync-stats` | Aggregated sync stats |
| POST   | `/api/orders/resync-failed` | Re-queue failed orders |
| POST   | `/api/orders/sync-missing` | Back-fill missing orders |
| GET    | `/api/orders/sync-missing/active` | Current backfill job |
| GET    | `/api/orders/queue-stats` | Queue depth |

Recipes:

```bash
# Get the 20 most recent orders across all user stores
curl -H "x-api-key: $BOT_KEY" "<BASE_URL>/api/orders?limit=20"

# Kick off a sync for a single store
curl -X POST -H "x-api-key: $BOT_KEY" -H 'content-type: application/json' \
  -d '{"storeId":"STORE_ID"}' "<BASE_URL>/api/orders/sync"
```

### 6.2 Order search & dispute

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/order-search` | Search orders across all user stores |
| GET | `/api/analytics/order-details` | Full order detail |
| PUT | `/api/analytics/order-note` | Update internal note |
| GET | `/api/analytics/customer-search` | Search customers across stores |
| GET | `/api/analytics/disputes` | List disputes |

### 6.3 Draft orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/draft-orders` | List draft orders |
| POST | `/api/draft-orders` | Create a draft order |
| GET | `/api/draft-orders/:id` | Get draft order |
| PUT | `/api/draft-orders/:id` | Update draft order |
| GET | `/api/draft-orders/products` | Search products for draft order |
| GET | `/api/draft-orders/customers` | Search customers |

### 6.4 Products

Two surfaces:

- `/api/products` — CSV import / history (bulk onboarding)
- `/api/shopify-products` — live Shopify product CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/products/upload-csv` | Import products from CSV |
| POST   | `/api/products/direct-import` | Direct (non-CSV) import |
| GET    | `/api/products/import-history` | List import jobs |
| GET    | `/api/products/successful-imports` | Successful imports |
| GET    | `/api/products/imports/:importId` | Import detail |
| POST   | `/api/products/imports/:importId/retry` | Retry failed rows |
| DELETE | `/api/products/imports/:importId` | Delete history row |
| GET    | `/api/shopify-products/list` | List products |
| GET    | `/api/shopify-products/:id` | Product detail |
| POST   | `/api/shopify-products` | Create product |
| PUT    | `/api/shopify-products/:id` | Update product |
| DELETE | `/api/shopify-products/:id` | Delete product |
| POST   | `/api/shopify-products/bulk-action` | Bulk archive / publish / delete |
| POST   | `/api/shopify-products/:id/duplicate` | Duplicate product |
| POST   | `/api/shopify-products/:id/inventory` | Set inventory |
| POST   | `/api/shopify-products/:id/publish` | Publish to channels |
| POST   | `/api/shopify-products/:id/variants` | Add variant |

Recipe — CSV import:

```bash
curl -X POST -H "x-api-key: $BOT_KEY" -F 'file=@./products.csv' \
  -F 'storeId=STORE_ID' "<BASE_URL>/api/products/upload-csv"
```

### 6.5 Collections

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/collections/list` | List collections |
| GET | `/api/collections/:id` | Get collection |
| POST | `/api/collections` | Create |
| PUT | `/api/collections/:id` | Update |
| DELETE | `/api/collections/:id` | Delete |
| POST | `/api/collections/:id/products` | Add products |
| DELETE | `/api/collections/:id/products` | Remove products |

### 6.6 Tracking

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tracking/update` | Apply tracking to fulfillments |
| GET  | `/api/tracking/preview` | Preview upload |
| GET  | `/api/tracking/fulfillments` | Order fulfillments |
| GET  | `/api/tracking/records` | Import records |
| POST | `/api/tracking/upload-excel` | Bulk upload |
| GET  | `/api/tracking/import-history` | History |
| GET  | `/api/tracking-status/statuses` | Current statuses |
| GET  | `/api/tracking-status/orders` | Orders for status check |
| POST | `/api/tracking-status/check-orders` | Trigger status check |
| POST | `/api/tracking-status/check-single` | Single tracking |
| GET  | `/api/tracking-status/stats` | Dashboard stats |

### 6.7 Dashboard & analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Homepage stats |
| GET | `/api/dashboard/finance-summary` | Finance summary |
| GET | `/api/analytics/stats` | Analytics overview |
| GET | `/api/analytics/store-stats` | Per-store analytics |
| GET | `/api/analytics/order-analytics` | Order analytics |
| GET | `/api/analytics/order-analytics-batch` | Batched version |
| GET | `/api/analytics/campaign-ads` | Campaign ads |
| GET | `/api/analytics/campaign-ads/all-stores` | All stores |

Recipe — "Get this week's order analytics":

```bash
NOW=$(date +%Y-%m-%d)
WEEK_AGO=$(date -v -7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
curl -H "x-api-key: $BOT_KEY" \
  "<BASE_URL>/api/analytics/order-analytics?from=$WEEK_AGO&to=$NOW"
```

### 6.8 Gmail

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gmail/accounts` | Linked Gmail accounts |
| GET | `/api/gmail/emails` | List emails (supports `q`, `labelIds`, `maxResults`, `pageToken`) |
| GET | `/api/gmail/emails/:messageId` | Email detail |
| GET | `/api/gmail/labels` | Labels |
| POST | `/api/gmail/disconnect` | Disconnect account |

Recipe — "This week's unread emails":

```bash
curl -H "x-api-key: $BOT_KEY" \
  "<BASE_URL>/api/gmail/emails?q=is:unread+newer_than:7d&maxResults=50"
```

### 6.9 Outlook

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/outlook/accounts` | Linked Outlook accounts |
| GET | `/api/outlook/emails` | List emails |
| GET | `/api/outlook/emails/:messageId` | Email detail |
| GET | `/api/outlook/folders` | List folders |

### 6.10 Stores & groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stores` | List user's stores |
| GET | `/api/stores/:storeId` | Store detail |
| PUT | `/api/stores/:storeId` | Update store |
| GET | `/api/stores/balance` | Single-store balance |
| GET | `/api/stores/balances` | All balances |
| GET | `/api/store-groups` | List groups |

### 6.11 Shipping & order limits

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/shipping/templates` | List shipping templates |
| POST | `/api/shipping/templates` | Create |
| GET | `/api/shipping/templates/:id` | Detail |
| POST | `/api/shipping/bulk-apply` | Bulk apply |
| GET | `/api/shipping/order-limits` | Order limits |

### 6.12 Setup & policies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/setup/definitions` | Setup step definitions |
| POST | `/api/setup/check` | Check all steps |
| POST | `/api/setup/apply` | Apply setup |
| GET | `/api/policy-templates` | Policy templates |
| PUT | `/api/policy-templates` | Save templates |

### 6.13 Custom fields

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/custom-fields` | List |
| POST | `/api/custom-fields` | Create |
| PUT | `/api/custom-fields/:id` | Update |
| DELETE | `/api/custom-fields/:id` | Delete |
| POST | `/api/custom-fields/deploy` | Deploy to stores |

### 6.14 Token delegation (fast path — call providers directly)

> Use this when the bot needs to run **many parallel reads** across stores/inboxes (e.g. multi-store Order/Customer search, multi-account email search). Instead of paying a server round-trip per request, mint provider tokens once and let the bot call Shopify / Gmail / Microsoft Graph directly.

All three endpoints respect `storeIds` restrictions configured on the bot API key, and enforce the user's `assignedStores` for non-admin owners. Every delegation is recorded in `bot_api_audit_log` (event `token-delegated`).

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/bot/tokens/shopify` | `{storeIds?: string[]}` | array of `{storeId, shopDomain, name, accessToken, apiVersion, graphqlUrl}` |
| POST | `/api/bot/tokens/gmail`   | `{storeIds?: string[], emails?: string[]}` | array of `{email, storeId, accessToken, refreshToken, expiresAt, scope, provider:"gmail"}` |
| POST | `/api/bot/tokens/outlook` | `{storeIds?: string[], emails?: string[]}` | array of `{email, storeId, accessToken, refreshToken, expiresAt, scope, provider:"outlook"}` |

Notes:

- **Shopify** `accessToken` is long-lived; cache it until you hit a 401, then re-mint.
- **Gmail / Outlook** return a freshly refreshed `accessToken` (~1 h TTL) plus the stored `refreshToken`. When the access token expires, either re-call this endpoint or refresh yourself using your own OAuth client.
- Pass `storeIds: []` (or omit) to fetch every store / account the key can reach.
- Token payloads are sensitive — treat as credentials, never log raw.

#### Recipe — parallel Order search across every store

```bash
# Step 1: mint Shopify tokens for every store the key can reach
TOKENS=$(curl -s -X POST -H "x-api-key: $BOT_KEY" -H 'content-type: application/json' \
  -d '{}' "<BASE_URL>/api/bot/tokens/shopify")

# Step 2: run the same GraphQL query against every store in parallel (bot side)
echo "$TOKENS" | jq -c '.data[]' | xargs -I{} -P10 bash -c '
  ROW={};
  URL=$(echo "$ROW" | jq -r .graphqlUrl);
  TOKEN=$(echo "$ROW" | jq -r .accessToken);
  curl -s -X POST "$URL" \
    -H "X-Shopify-Access-Token: $TOKEN" \
    -H "content-type: application/json" \
    -d "{\"query\":\"{ orders(first:10,query:\\\"name:1001\\\"){ edges{ node{ id name } } } }\"}"
'
```

The same pattern works for the **Customers** connection — swap `orders(...)` for `customers(query:"email:foo@bar.com", first:10)` in the GraphQL body.

#### Recipe — parallel email search across every Gmail account

```bash
TOKENS=$(curl -s -X POST -H "x-api-key: $BOT_KEY" -H 'content-type: application/json' \
  -d '{}' "<BASE_URL>/api/bot/tokens/gmail")

echo "$TOKENS" | jq -c '.data[]' | xargs -I{} -P10 bash -c '
  ROW={};
  TOKEN=$(echo "$ROW" | jq -r .accessToken);
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:7d&maxResults=25"
'
```

For Outlook, swap the URL for `https://graph.microsoft.com/v1.0/me/messages?...` — the `accessToken` in the Outlook response is already a valid Graph bearer token.

### 6.15 Managing bot keys themselves (admin only)

> `/api/bot-api-keys/*` routes require admin role — staff bot keys receive 403.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bot-api-keys` | List all bot API keys (shared admin pool) |
| POST | `/api/bot-api-keys` | Mint a new key — response includes raw key ONCE |
| POST | `/api/bot-api-keys/:id/revoke` | Soft-revoke a key |

Admins can revoke any admin's key (shared pool). There is **no hard-delete** — revoked rows stay for audit.

---

## 7. Response shape

All responses follow:

```json
{"success": true, "data": <payload>}
```

or on error:

```json
{"success": false, "error": "<message>", "code": "<optional>"}
```

---

## 8. Common task recipes

These are the patterns an AI should pick up when building calls:

### "Get last 30 days of orders for all stores"

```bash
curl -H "x-api-key: $BOT_KEY" \
  "<BASE_URL>/api/orders?limit=200&days=30"
```

### "Summarize this week's Gmail inbox"

```bash
curl -H "x-api-key: $BOT_KEY" \
  "<BASE_URL>/api/gmail/emails?q=newer_than:7d&maxResults=50"
```

### "Check tracking status for a single number"

```bash
curl -X POST -H "x-api-key: $BOT_KEY" -H 'content-type: application/json' \
  -d '{"trackingNumber":"ABC123"}' \
  "<BASE_URL>/api/tracking-status/check-single"
```

### "Mint and immediately use a key" (admin JWT session)

```bash
NEW=$(curl -s -X POST -H "x-client-id: $USER_ID" -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"name":"Gemini Bot"}' \
  "<BASE_URL>/api/bot-api-keys" | jq -r .data.raw)

curl -H "x-api-key: $NEW" "<BASE_URL>/api/orders?limit=5"
```

---

## 9. Security notes

- **Never commit API keys to git.** Inject via env var (e.g. `BOT_KEY`).
- **Treat keys like passwords.** If leaked, revoke immediately from the Bot API Keys admin page.
- **Rotation:** create a new key, deploy it to your bot, then revoke the old key.
- **HTTPS only** — enforced by Cloud Functions.
- **`scopes: []` field exists but is not yet enforced.** All keys currently grant full access to the owning user's data. Per-scope enforcement is future work.
- **Management routes are admin-only.** Staff accounts cannot mint or revoke keys.
- **Audit log**: creations, revocations, sampled usage events, and every token delegation (`token-delegated`) are appended to the `bot_api_audit_log` Firestore collection (90-day TTL).
- **Delegated tokens** are long-lived credentials (Shopify never expires; Gmail/Outlook refresh tokens outlive individual access tokens). Store them in a secret manager, never in git, and revoke the parent bot key to invalidate access.
