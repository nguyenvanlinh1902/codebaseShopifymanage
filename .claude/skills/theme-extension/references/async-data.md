# Async Data Fetching with Loading States

## HTML Structure

```liquid
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

## JavaScript Pattern

```javascript
(function() {
  var PROXY_PATH = '/apps/proxy';
  var ENDPOINT = '/data';

  var containers = document.querySelectorAll('.app-widget');

  containers.forEach(function(container) {
    var resourceId = container.dataset.resourceId;
    var loadingEl = document.getElementById('app-loading-' + resourceId);
    var contentEl = document.getElementById('app-content-' + resourceId);
    var errorEl = document.getElementById('app-error-' + resourceId);

    async function fetchData() {
      try {
        var params = new URLSearchParams({
          resource_id: resourceId,
          shop: container.dataset.shop
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

        contentEl.innerHTML = buildHTML(result.data);
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
      } catch (error) {
        console.error('Widget error:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fetchData);
    } else {
      fetchData();
    }
  });
})();
```

## CSS Utilities

```css
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

.app-widget[data-hidden="true"] {
  display: none;
}
```

## Key Points

| Aspect | Recommendation |
|--------|----------------|
| Unique IDs | Use resource ID (product, collection) |
| Loading state | Always show spinner while fetching |
| Error handling | Show user-friendly error |
| Empty state | Use `data-hidden="true"` to hide |
| Translations | Use Liquid `t` filter for text |
