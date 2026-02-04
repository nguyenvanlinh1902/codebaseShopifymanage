---
name: theme-extension
description: Use this skill when the user asks about "theme extension", "app blocks", "Liquid templates", "app embed", "storefront rendering", "app proxy", or any Theme App Extension development work. Provides patterns for Liquid-first storefront rendering with minimal JavaScript.
---

# Theme App Extension Development

## Quick Reference

| Topic | Reference File |
|-------|---------------|
| Block Schema, Settings, App Embed | [references/app-blocks.md](references/app-blocks.md) |
| Loading States, Async Fetch Pattern | [references/async-data.md](references/async-data.md) |
| App Proxy Config, Backend Handler | [references/app-proxy.md](references/app-proxy.md) |

---

## Overview

Theme App Extensions use Shopify's native Liquid rendering for **optimal storefront performance**. Content is server-rendered before reaching the customer's browser.

### When to Use

| Approach | Use For |
|----------|---------|
| **Theme Extension** | Static/semi-static content, SEO-critical content |
| **Scripttag** | Highly interactive widgets, real-time updates |

---

## Directory Structure

```
extensions/theme-extension/
├── blocks/                    # App blocks (merchant can position)
│   ├── feature-block.liquid
│   └── badge.liquid
├── snippets/                  # Reusable Liquid snippets
├── assets/                    # JS/CSS files
└── locales/
    └── en.default.json        # Translations
```

---

## Liquid-First Rendering

```liquid
{% comment %} Data from metafields {% endcomment %}
{% assign items = product.metafields.app_namespace.items.value %}

{% if items.size > 0 %}
  <div class="items-list">
    {% for item in items %}
      {% render 'item-card', item: item %}
    {% endfor %}
  </div>
{% else %}
  <p class="no-items">{{ 'app.no_items' | t }}</p>
{% endif %}
```

---

## Minimal JavaScript Pattern

### When JS is Needed

| Use JS For | Keep in Liquid |
|------------|----------------|
| Form submission | Static content display |
| File upload | Badges and indicators |
| Pagination/load more | Product lists |
| Real-time validation | SEO content |

### Minimal JS Structure

```javascript
(function() {
  'use strict';
  const config = window.APP_CONFIG || {};

  function initForms() {
    document.querySelectorAll('[data-app-form]').forEach(form => {
      form.addEventListener('submit', handleSubmit);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }
})();
```

---

## Translations

```json
{
  "app": {
    "title": "Feature Title",
    "submit": "Submit",
    "success": "Submitted successfully"
  }
}
```

```liquid
{{ 'app.title' | t }}
{{ 'app.count' | t: count: items.size }}
```

---

## Performance Guidelines

### Do's

| Practice | Why |
|----------|-----|
| Render in Liquid | Server-side = faster |
| Use snippets | Reusable, cacheable |
| Defer JS loading | Non-blocking |
| Scope CSS | Avoid conflicts |

### Don'ts

| Avoid | Why |
|-------|-----|
| Heavy JS frameworks | Bundle size |
| Inline styles | Cache miss |
| Blocking scripts | Slow page load |

---

## Checklist

```
Block Development:
- Schema defines all settings
- Uses snippets for reusable parts
- Translations for all text
- Scoped CSS (no global pollution)
- Minimal/no inline JS

Performance:
- JS deferred or async
- CSS in stylesheet (not inline)
- Images lazy loaded
- No external dependencies
- Bundle < 20KB total
```
