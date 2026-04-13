/**
 * Generates a DYNAMIC Liquid snippet that reads field config from collection metafield.
 * Collection metafield custom.custom_fields_config stores JSON array of fields.
 * Snippet parses JSON and renders inputs dynamically — no need to re-paste when fields change.
 */
export function generateLiquidSnippet() {
  return `{% comment %}
  Custom Fields — powered by ToolShopify.
  Reads field config from collection metafield (custom.custom_fields_config).
  Paste this BEFORE the Add to Cart button inside your product form.
  No need to update when fields change — config is read from metafield.
{% endcomment %}
{% assign cf_config = blank %}
{% for col in product.collections %}
  {% if col.metafields.custom.custom_fields_config != blank %}
    {% assign cf_config = col.metafields.custom.custom_fields_config %}
    {% break %}
  {% endif %}
{% endfor %}
{% if cf_config != blank %}
  {% assign cf_fields = cf_config | parse_json %}
  <div class="custom-fields-container">
    {% for field in cf_fields %}
      <div class="custom-field">
        <label for="custom-field-{{ field.key }}">
          {{ field.label }}
          {% if field.required %}<span class="custom-field-required">*</span>{% endif %}
        </label>
        {% if field.inputType == "textarea" %}
          <textarea id="custom-field-{{ field.key }}" name="properties[{{ field.label }}]" {% if field.required %}required{% endif %} rows="3"></textarea>
        {% else %}
          <input type="{{ field.inputType }}" id="custom-field-{{ field.key }}" name="properties[{{ field.label }}]" {% if field.required %}required{% endif %} />
        {% endif %}
      </div>
    {% endfor %}
  </div>

  <style>
    .custom-fields-container { margin: 16px 0; }
    .custom-field { margin-bottom: 12px; }
    .custom-field label { display: block; margin-bottom: 4px; font-weight: 500; }
    .custom-field input,
    .custom-field textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .custom-field-required { color: #e51c23; }
  </style>
{% endif %}`;
}
