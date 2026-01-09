---
name: theme-extension
description: Use this skill when the user asks about "theme extension", "app blocks", "Liquid templates", "app embed", "storefront rendering", "app proxy", or any Theme App Extension development work. Provides patterns for Liquid-first storefront rendering with minimal JavaScript.
---

# Theme App Extension Development

## Overview

Theme App Extensions use Shopify's native Liquid rendering for **optimal storefront performance**. Content is server-rendered before reaching the customer's browser.

### When to Use

| Approach | Use For |
|----------|---------|
| **Theme Extension** | Static/semi-static content, SEO-critical content, product displays |
| **Scripttag** | Highly interactive widgets, real-time updates, complex UI |

---

## Directory Structure

```
extensions/theme-extension/
├── blocks/                    # App blocks (merchant can position)
│   ├── feature-block.liquid   # Main feature block
│   └── badge.liquid           # Small badge/snippet
├── snippets/                  # Reusable Liquid snippets
│   └── component.liquid       # Shared components
├── assets/                    # JS/CSS files
│   ├── app-embed.js           # Minimal JS (forms, interactions)
│   └── styles.css             # Scoped styles
└── locales/
    └── en.default.json        # Translations
```

---

## App Block Pattern

### Block Schema

```liquid
{% schema %}
{
  "name": "Feature Name",
  "target": "section",
  "enabled_by_default": false,
  "settings": [
    {
      "type": "range",
      "id": "items_per_page",
      "label": "Items per page",
      "min": 3,
      "max": 20,
      "default": 10
    },
    {
      "type": "color",
      "id": "primary_color",
      "label": "Primary color",
      "default": "#000000"
    }
  ]
}
{% endschema %}

{% comment %} Block content {% endcomment %}
<div class="app-feature" data-resource-id="{{ product.id }}">
  {% render 'app-component', resource: product, settings: block.settings %}
</div>

{% stylesheet %}
  .app-feature { /* scoped styles */ }
{% endstylesheet %}

{% javascript %}
  // Minimal JS only when needed
{% endjavascript %}
```

### Block Targets

| Target | Use For |
|--------|---------|
| `section` | Product page, collection page content |
| `body` | Global elements (popups, floating buttons) |

---

## App Embed (Global Script)

For loading global CSS and minimal JS across all pages:

```liquid
{% schema %}
{
  "name": "App Embed",
  "target": "body",
  "enabled_by_default": true,
  "settings": []
}
{% endschema %}

{% comment %} Load styles globally {% endcomment %}
{{ 'styles.css' | asset_url | stylesheet_tag }}

{% comment %} Minimal JS - forms, interactions only {% endcomment %}
<script src="{{ 'app-embed.js' | asset_url }}" defer></script>

{% comment %} Pass data to JS {% endcomment %}
<script>
  window.APP_CONFIG = {
    shopDomain: '{{ shop.permanent_domain }}',
    customerId: '{{ customer.id | default: "" }}',
    locale: '{{ request.locale.iso_code }}'
  };
</script>
```

---

## App Proxy Integration

### Configure in shopify.app.toml

```toml
[app_proxy]
url = "https://<firebase-url>/clientApi"
subpath = "app-name"
subpath_prefix = "apps"
```

### Fetch Data via App Proxy

```liquid
{% comment %}
  App proxy URL: /apps/app-name/endpoint
  Shopify adds shop param automatically
{% endcomment %}

{% assign api_url = shop.url | append: '/apps/app-name/data/' | append: resource.id %}
```

### Backend Handler

```javascript
// clientApi controller - receives 'shop' query param from app proxy
export async function getData(ctx) {
  const shopDomain = ctx.query.shop;
  const {id} = ctx.params;

  const shop = await shopRepository.getShopByShopifyDomain(shopDomain);
  if (!shop) {
    ctx.body = {success: false, error: 'Shop not found'};
    return;
  }

  const data = await service.getData(shop.id, id);
  ctx.body = data;
}
```

---

## Async Data Fetching with Loading States

When blocks need dynamic data from app proxy, use loading states for good UX.

### HTML Structure

```liquid
{% comment %}
  Generic async widget pattern
  - Unique IDs using resource ID (product, collection, page, etc.)
  - Data attributes for JS configuration
  - Loading/content/error states
{% endcomment %}

{% assign widget_id = product.id | default: collection.id | default: 'global' %}

<div class="app-widget"
     data-resource-id="{{ widget_id }}"
     data-resource-type="{{ resource_type | default: 'product' }}"
     data-shop="{{ shop.permanent_domain }}"
     id="app-widget-{{ widget_id }}">

  <div class="app-widget__loading" id="app-loading-{{ widget_id }}">
    <span class="app-widget__spinner"></span>
    {{ 'app.loading' | t | default: 'Loading...' }}
  </div>

  <div class="app-widget__content" id="app-content-{{ widget_id }}" style="display: none;">
    {%- comment -%} Content populated by JS {%- endcomment -%}
  </div>

  <div class="app-widget__error" id="app-error-{{ widget_id }}" style="display: none;">
    {{ 'app.error' | t | default: 'Unable to load content' }}
  </div>
</div>
```

### JavaScript Pattern

```javascript
(function() {
  // Configuration
  var PROXY_PATH = '/apps/proxy';  // Your app proxy path
  var ENDPOINT = '/data';          // Your endpoint

  // Get elements
  var containers = document.querySelectorAll('.app-widget');

  containers.forEach(function(container) {
    var resourceId = container.dataset.resourceId;
    var resourceType = container.dataset.resourceType;
    var shop = container.dataset.shop;

    var loadingEl = document.getElementById('app-loading-' + resourceId);
    var contentEl = document.getElementById('app-content-' + resourceId);
    var errorEl = document.getElementById('app-error-' + resourceId);

    async function fetchData() {
      try {
        var params = new URLSearchParams({
          resource_id: resourceId,
          resource_type: resourceType,
          shop: shop
        });

        var response = await fetch(PROXY_PATH + ENDPOINT + '?' + params);
        var result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Request failed');
        }

        if (!result.data) {
          container.dataset.hidden = 'true';
          return;
        }

        renderContent(result.data, result.settings);
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
      } catch (error) {
        console.error('Widget error:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
      }
    }

    function renderContent(data, settings) {
      // Build your HTML from data
      contentEl.innerHTML = buildHTML(data, settings);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fetchData);
    } else {
      fetchData();
    }
  });
})();
```

### CSS Utilities

```css
/* Loading spinner */
.app-widget__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e5e5;
  border-top-color: var(--app-accent-color, #008060);
  border-radius: 50%;
  animation: app-spin 0.8s linear infinite;
}

@keyframes app-spin {
  to { transform: rotate(360deg); }
}

/* Hide widget when no data */
.app-widget[data-hidden="true"] {
  display: none;
}

/* Loading state */
.app-widget__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: #666;
}

/* Error state */
.app-widget__error {
  padding: 16px;
  color: #c00;
  text-align: center;
}
```

### Key Points

| Aspect | Recommendation |
|--------|----------------|
| Unique IDs | Use resource ID (product, collection, etc.) for uniqueness |
| Loading state | Always show spinner while fetching |
| Error handling | Show user-friendly error, hide widget on failure |
| Empty state | Use `data-hidden="true"` to hide when no data |
| Translations | Use Liquid `t` filter for user-facing text |

---

## Liquid-First Rendering

### Server-Side Data Display

```liquid
{% comment %} Data from metafields or app proxy {% endcomment %}
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

### Reusable Snippets

```liquid
{% comment %} snippets/rating-display.liquid {% endcomment %}
{% comment %}
  @param value {number} - Value to display
  @param max {number} - Maximum value
  @param size {string} - 'small' | 'medium' | 'large'
{% endcomment %}

<div class="rating-display rating-display--{{ size | default: 'medium' }}">
  {% for i in (1..max) %}
    {% if i <= value %}
      <span class="rating-unit rating-unit--filled"></span>
    {% else %}
      <span class="rating-unit rating-unit--empty"></span>
    {% endif %}
  {% endfor %}
</div>
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
// assets/app-embed.js

(function() {
  'use strict';

  const config = window.APP_CONFIG || {};

  // Form handling
  function initForms() {
    document.querySelectorAll('[data-app-form]').forEach(form => {
      form.addEventListener('submit', handleSubmit);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(data)),
        headers: {'Content-Type': 'application/json'}
      });

      const result = await response.json();
      if (result.success) {
        showMessage(form, 'success', result.data.message);
      } else {
        showMessage(form, 'error', result.error);
      }
    } catch (err) {
      showMessage(form, 'error', 'Something went wrong');
    }
  }

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }
})();
```

---

## Translations

### Locale File Structure

```json
{
  "app": {
    "title": "Feature Title",
    "submit": "Submit",
    "success": "Submitted successfully",
    "error": "Something went wrong",
    "no_items": "No items yet"
  }
}
```

### Using Translations

```liquid
{% comment %} In Liquid {% endcomment %}
{{ 'app.title' | t }}

{% comment %} With variables {% endcomment %}
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
| Fetch on page load | Delays rendering |

---

## Checklist

### Block Development

```
- Schema defines all settings
- Uses snippets for reusable parts
- Translations for all text
- Scoped CSS (no global pollution)
- Minimal/no inline JS
```

### App Proxy Integration

```
- shopify.app.toml configured
- Backend validates shop parameter
- Returns JSON for JS consumption
- HTML rendering for Liquid consumption
```

### Performance

```
- JS deferred or async
- CSS in stylesheet (not inline)
- Images lazy loaded
- No external dependencies
- Bundle < 20KB total
```