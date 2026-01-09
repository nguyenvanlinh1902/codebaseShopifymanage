---
name: storefront-widget
description: Use this skill when the user asks about "storefront widget", "scripttag", "customer-facing", "Preact", "bundle size", "lazy loading", "performance optimization", or any storefront frontend work. Provides Preact patterns for lightweight storefront widgets.
---

# Scripttag Development (Storefront Widget)

## Overview

The scripttag package contains **customer-facing storefront widgets** injected into merchant stores. Performance is **CRITICAL** - every KB and millisecond impacts merchant store speed and conversion rates.

---

## Architecture

### Tech Stack

| Technology | Purpose | Why |
|------------|---------|-----|
| **Preact** | UI library | 3KB vs React's 40KB+ |
| **preact-lazy** | Lazy loading | Lightweight lazy loader |
| **SCSS** | Styling | Scoped styles, minimal footprint |
| **Rspack** | Bundler | 10x faster than webpack |
| **Theme App Extension** | Script loading | Shopify-native, no ScriptTag API |

> **Styling:** Always use custom SCSS/CSS. Avoid UI libraries - they add unnecessary bundle size.

### Loading via Theme App Extension (Recommended)

Scripts are loaded via Theme App Extension app embed block, not the deprecated ScriptTag API.

```
extensions/theme-extension/
├── blocks/
│   └── app-embed.liquid      # App embed block (loads script)
├── assets/
│   └── app-widget.js         # Minimal loader (or inline in liquid)
└── locales/
    └── en.default.json
```

#### App Embed Block (blocks/app-embed.liquid)
```liquid
{% comment %}
  App embed block - loads the storefront widget
  Enabled by merchant in Theme Editor > App Embeds
{% endcomment %}

{% liquid
  assign app_url = shop.metafields.app.script_url | default: 'https://cdn.example.com'
%}

<script>
  window.AVADA_APP_DATA = {
    shop: {{ shop | json }},
    customer: {{ customer | json }},
    settings: {{ block.settings | json }},
    productId: {{ product.id | json }},
    config: {{ shop.metafields['$app:feature']['config'].value | json }}
  };
</script>

<script src="{{ app_url }}/widget.min.js" defer></script>

{% schema %}
{
  "name": "App Widget",
  "target": "body",
  "settings": [
    {
      "type": "checkbox",
      "id": "enabled",
      "label": "Enable widget",
      "default": true
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
```

#### Why Theme App Extension over ScriptTag API

| Aspect | Theme App Extension | ScriptTag API |
|--------|---------------------|---------------|
| **Deprecation** | Current standard | Deprecated |
| **Merchant control** | Theme Editor toggle | None |
| **Settings UI** | Built-in schema | Custom needed |
| **Liquid access** | Full (shop, product, customer) | None |
| **Metafield access** | Direct in Liquid | Requires fetch |
| **Performance** | Can use `defer`/`async` | Limited control |

---

## Directory Structure

```
packages/scripttag/
├── src/                      # Main widget entry
│   ├── index.js              # Main entry point
│   ├── loader.js             # Minimal loader script
│   ├── components/           # Shared components
│   ├── managers/             # API, Display managers
│   ├── helpers/              # Utility functions
│   └── styles/               # Global styles
├── [feature-name]/           # Feature-specific modules
│   ├── index.js              # Feature entry point
│   ├── components/           # Feature components
│   └── helpers/              # Feature helpers
└── rspack.config.js          # Build configuration
```

---

## Performance Rules (CRITICAL)

### 1. Minimal Loader Pattern

```javascript
// loader.js - Keep as small as possible (~2KB)
function loadScript() {
  const script = document.createElement('script');
  script.async = true;
  script.src = `${CDN_URL}/main.min.js`;
  document.head.appendChild(script);
}

// Load after page ready (non-blocking)
if (document.readyState === 'complete') {
  setTimeout(loadScript, 1);
} else {
  window.addEventListener('load', loadScript, false);
}
```

### 2. Lazy Loading Components

```javascript
import lazy from 'preact-lazy';

const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### 3. Tree Shaking

```javascript
// BAD: Import entire library
import * as utils from '@avada/utils';

// GOOD: Import only what you need
import {isEmpty} from '@avada/utils/lib/isEmpty';

// BAD: Barrel imports
import {formatDate, formatCurrency} from '../helpers';

// GOOD: Direct path imports
import formatDate from '../helpers/formatDate';
import formatCurrency from '../helpers/formatCurrency';
```

### 4. Bundle Size Limits

| Component | Target Size |
|-----------|-------------|
| Loader script | < 3KB gzipped |
| Main bundle | < 50KB gzipped |
| Feature chunk | < 30KB gzipped |
| Initial load total | < 60KB gzipped |

---

## Preact Patterns

### Use Preact Instead of React

```javascript
// Use preact directly
import {render} from 'preact';
import {useState, useEffect} from 'preact/hooks';

// Rspack aliases handle React compat:
// 'react' -> 'preact/compat'
// 'react-dom' -> 'preact/compat'
```

### Functional Components with Hooks

```javascript
import {useState, useEffect, useMemo, useCallback} from 'preact/hooks';

function Widget() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return data ? <Display data={data} /> : null;
}
```

---

## Styling (Recommended Approach)

### Custom SCSS (Preferred)

```scss
// Lightweight custom styles with BEM
.widget {
  &__button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--primary-color);
    color: white;
    cursor: pointer;

    &:hover {
      opacity: 0.9;
    }

    &--secondary {
      background: transparent;
      border: 1px solid var(--primary-color);
      color: var(--primary-color);
    }
  }
}
```

### CSS Variables for Theming

```scss
:root {
  --primary-color: #{$primaryColor};
  --text-color: #{$textColor};
  --bg-color: #{$backgroundColor};
}

.card {
  background: var(--bg-color);
  color: var(--text-color);
}
```

---

## Window Data Pattern

Storefront widgets receive data via global window object:

```javascript
const {
  shop,           // Shop configuration
  customer,       // Current customer data
  settings,       // Widget settings
  translation,    // i18n translations
} = window.APP_DATA || {};

// Always destructure with defaults
const {items = [], config = {}} = settings || {};
```

---

## Development Commands

```bash
# Development with watch
npm run watch

# Production build
npm run build

# Analyze bundle size
npm run build:analyze

# Development build (unminified)
npm run build:dev
```

---

## Request Interception

Intercept Shopify storefront requests to modify data, add properties, or track analytics.

### Common Use Cases

| Endpoint | Use Case |
|----------|----------|
| `/cart/add` | Modify quantity, add line item properties |
| `/cart/update` | Adjust quantities, apply discounts |
| `/cart/change` | Track cart modifications |
| `/contact` | Add hidden fields, track submissions |

### Fetch Interception

```javascript
(function() {
  if (window.__appInterceptorInstalled) return;
  window.__appInterceptorInstalled = true;

  const INTERCEPT_URLS = ['/cart/add', '/cart/update']; // Configure endpoints

  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
    const shouldIntercept = INTERCEPT_URLS.some(endpoint => urlStr.includes(endpoint));

    if (shouldIntercept && options && options.body) {
      try {
        const modifiedData = getModifiedData(urlStr); // Your modification logic
        if (modifiedData) {
          if (typeof options.body === 'string') {
            const body = JSON.parse(options.body);
            Object.assign(body, modifiedData);
            options = {...options, body: JSON.stringify(body)};
          } else if (options.body instanceof FormData) {
            Object.entries(modifiedData).forEach(([key, value]) => {
              options.body.set(key, String(value));
            });
          }
        }
      } catch (e) {
        console.log('Intercept error:', e);
      }
    }
    return originalFetch.call(this, url, options);
  };
})();
```

### XMLHttpRequest Interception

```javascript
(function() {
  const INTERCEPT_URLS = ['/cart/add', '/cart/update'];
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._interceptUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(data) {
    const shouldIntercept = INTERCEPT_URLS.some(endpoint =>
      this._interceptUrl && this._interceptUrl.includes(endpoint)
    );

    if (shouldIntercept && data) {
      try {
        const modifiedData = getModifiedData(this._interceptUrl);
        if (modifiedData) {
          if (typeof data === 'string') {
            const parsed = JSON.parse(data);
            Object.assign(parsed, modifiedData);
            data = JSON.stringify(parsed);
          } else if (data instanceof FormData) {
            Object.entries(modifiedData).forEach(([key, value]) => {
              data.set(key, String(value));
            });
          }
        }
      } catch (e) {
        console.log('Intercept error:', e);
      }
    }
    return originalSend.call(this, data);
  };
})();
```

### Form Submission Interception

```javascript
(function() {
  const INTERCEPT_URLS = ['/cart/add', '/cart/update'];

  document.addEventListener('submit', function(e) {
    const form = e.target;
    const shouldIntercept = INTERCEPT_URLS.some(endpoint =>
      form.action && form.action.includes(endpoint)
    );

    if (shouldIntercept) {
      const modifiedData = getModifiedData(form.action);
      if (modifiedData) {
        Object.entries(modifiedData).forEach(([key, value]) => {
          const input = form.querySelector(`[name="${key}"]`);
          if (input) {
            input.value = value;
          } else {
            // Create hidden input for new fields
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = key;
            hidden.value = value;
            form.appendChild(hidden);
          }
        });
      }
    }
  }, true); // Capture phase
})();
```

### Key Points

| Aspect | Recommendation |
|--------|----------------|
| Install once | Use global flag `window.__appInterceptorInstalled` |
| Configure endpoints | Define `INTERCEPT_URLS` array for flexibility |
| Preserve original | Store and call original functions |
| Handle all methods | Intercept fetch, XHR, and form submissions |
| Error handling | Wrap in try-catch, fail gracefully |

---

## Checklist

### Before Commit

```
- No barrel imports (use direct paths)
- Heavy components lazy loaded
- Dynamic imports for conditional features
- Tree-shaking friendly imports
- No console.log in production
- Custom SCSS with BEM naming
- No UI library dependencies
```

### Bundle Size Check

```
- Run build:analyze
- Loader < 3KB gzipped
- No unexpected large chunks
- No duplicate dependencies
- All imports use direct paths
```

### Performance

```
- Loads after document ready
- Non-blocking script loading
- Retry logic with backoff
- Performance tracking in place
- No synchronous heavy operations
```