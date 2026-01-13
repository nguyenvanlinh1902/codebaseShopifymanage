# App Block Pattern

## Block Schema

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

## Block Targets

| Target | Use For |
|--------|---------|
| `section` | Product page, collection page content |
| `body` | Global elements (popups, floating buttons) |

## App Embed (Global Script)

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

## Setting Types

| Type | Example |
|------|---------|
| `range` | Numeric slider |
| `color` | Color picker |
| `checkbox` | Boolean toggle |
| `text` | Single line text |
| `textarea` | Multi-line text |
| `select` | Dropdown options |
| `product` | Product selector |
| `collection` | Collection selector |
