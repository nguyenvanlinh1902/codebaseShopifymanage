---
description: Test the Shopify app in browser using Playwright MCP
---

Use Playwright MCP to test the app in browser. Read `shopify.app.toml` first to get store and app info.

## What to Test

Based on the argument provided:

| Argument | Action |
|----------|--------|
| `admin` or empty | Open and test embedded admin app |
| `storefront` | Open storefront and test widgets |
| `theme` | Open theme editor for app extension |
| `checkout` | Test checkout flow with extensions |
| `cart` | Add product to cart and test |
| `order` | Create test order in admin |
| `settings` | Open Shopify admin settings |

## Testing Steps

### 1. Read Config
```
Read shopify.app.toml to get:
- dev_store_url → store name
- name → app handle (kebab-case)
```

### 2. Construct URLs
- **Admin App**: `https://admin.shopify.com/store/{store}/apps/{app-handle}/embed`
- **Storefront**: `https://{dev_store_url}`
- **Theme Editor**: `https://admin.shopify.com/store/{store}/themes/current/editor`

### 3. Test Flow
1. Navigate to URL using `mcp__playwright__browser_navigate`
2. Wait for load using `mcp__playwright__browser_wait_for`
3. Take snapshot using `mcp__playwright__browser_snapshot`
4. Check errors using `mcp__playwright__browser_console_messages`
5. Interact with elements using `mcp__playwright__browser_click`

### 4. Report Results
- Screenshot if needed
- Console errors found
- Network request issues
- Backend logs from `firebase-debug.log`

## Reference
See `.claude/skills/shopify-testing/skill.md` for detailed workflows.