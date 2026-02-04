---
name: storefront-widget
description: Use this skill when the user asks about "storefront widget", "scripttag", "customer-facing", "Preact", "bundle size", "lazy loading", "performance optimization", or any storefront frontend work. Provides Preact patterns for lightweight storefront widgets.
---

# Scripttag Development (Storefront Widget)

## Quick Reference

| Topic | Reference File |
|-------|---------------|
| Bundle Size, Lazy Loading, Tree Shaking | [references/performance.md](references/performance.md) |
| Preact Hooks, Sharing Components | [references/preact-patterns.md](references/preact-patterns.md) |
| Fetch/XHR/Form Interception | [references/request-interception.md](references/request-interception.md) |

---

## Overview

The scripttag package contains **customer-facing storefront widgets** injected into merchant stores. Performance is **CRITICAL** - every KB and millisecond impacts merchant store speed and conversion rates.

---

## Tech Stack

| Technology | Purpose | Why |
|------------|---------|-----|
| **Preact** | UI library | 3KB vs React's 40KB+ |
| **SCSS** | Styling | Scoped styles, minimal footprint |
| **Rspack** | Bundler | 10x faster than webpack |
| **Theme App Extension** | Script loading | Shopify-native |

> **Styling:** Always use custom SCSS/CSS. Avoid UI libraries.

---

## Directory Structure

```
packages/scripttag/
├── src/                      # Main widget entry
│   ├── index.js              # Main entry point
│   ├── loader.js             # Minimal loader script
│   ├── components/           # Shared components
│   └── styles/               # Global styles
├── [feature-name]/           # Feature-specific modules
└── rspack.config.js          # Build configuration
```

---

## Loading via Theme App Extension

```liquid
{% comment %} blocks/app-embed.liquid {% endcomment %}
<script>
  window.AVADA_APP_DATA = {
    shop: {{ shop | json }},
    customer: {{ customer | json }},
    settings: {{ block.settings | json }},
    config: {{ shop.metafields['$app:feature']['config'].value | json }}
  };
</script>

<script src="{{ app_url }}/widget.min.js" defer></script>
```

---

## Styling (SCSS with BEM)

```scss
.widget {
  &__button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--primary-color);
    color: white;

    &--secondary {
      background: transparent;
      border: 1px solid var(--primary-color);
    }
  }
}
```

---

## Environment Configuration

```javascript
// rspack.config.js loads in order:
// 1. .env.{ENVIRONMENT}
// 2. .env.local
// 3. .env

process.env.API_URL      // Backend API URL
process.env.HOST         // Current host URL
process.env.PUBLIC_PATH  // CDN path for assets
```

---

## Development Commands

```bash
npm run watch         # Development with watch
npm run build         # Production build
npm run build:analyze # Analyze bundle size
```

---

## Checklist

### Before Commit

```
- No barrel imports (use direct paths)
- Heavy components lazy loaded
- No console.log in production
- Custom SCSS with BEM naming
- No UI library dependencies
```

### Bundle Size Check

```
- Loader < 3KB gzipped
- Main bundle < 50KB gzipped
- No unexpected large chunks
```
