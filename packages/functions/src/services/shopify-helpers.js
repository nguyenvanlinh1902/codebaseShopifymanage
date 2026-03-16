/**
 * Shopify shared helpers - static utilities used across shopify service modules.
 */

export function toGid(type, id) {
  return String(id).startsWith('gid://') ? id : `gid://shopify/${type}/${id}`;
}

export function fromGid(gid) {
  return parseInt(gid.replace(/^gid:\/\/shopify\/\w+\//, ''));
}

/**
 * Build metafields array from product data.
 */
export function buildMetafieldsFromProduct(productData) {
  if (!productData.dynamicMetafields || productData.dynamicMetafields.length === 0) {
    return [];
  }
  return productData.dynamicMetafields;
}

/**
 * Build a Shopify variant object from variant data (REST shape).
 */
export function buildVariant(variantData) {
  const variant = {
    price: variantData.price || '0.00',
    compare_at_price: variantData.compareAtPrice || null,
    sku: variantData.sku || '',
    barcode: variantData.barcode || '',
    inventory_quantity: parseInt(variantData.inventoryQuantity || 0),
    inventory_management: variantData.inventoryTracker || 'shopify',
    inventory_policy: variantData.inventoryPolicy || 'deny',
    fulfillment_service: variantData.fulfillmentService || 'manual',
    weight: variantData.weight || 0,
    weight_unit: variantData.weightUnit || 'lb',
    requires_shipping:
      variantData.requiresShipping !== undefined ? variantData.requiresShipping : true,
    taxable: variantData.taxable !== undefined ? variantData.taxable : true
  };

  if (variantData.cost) variant.cost = variantData.cost;
  if (variantData.taxCode) variant.tax_code = variantData.taxCode;
  if (variantData.option1Value) variant.option1 = variantData.option1Value;
  if (variantData.option2Value) variant.option2 = variantData.option2Value;
  if (variantData.option3Value) variant.option3 = variantData.option3Value;

  return variant;
}

/**
 * Build normalized option key for variant matching.
 * "Default Title" is normalized to empty string for consistent matching.
 */
export function buildOptionKey(option1, option2, option3) {
  const normalize = v => (!v || v === 'Default Title') ? '' : v;
  return [normalize(option1), normalize(option2), normalize(option3)].join('|');
}

/**
 * Map GraphQL variant node to REST-compatible shape.
 */
export function gqlVariantToRest(node) {
  const opts = node.selectedOptions || [];
  return {
    id: fromGid(node.id),
    sku: node.sku || '',
    option1: opts[0]?.value || null,
    option2: opts[1]?.value || null,
    option3: opts[2]?.value || null
  };
}

/**
 * Normalize shop domain input — strips protocol, .myshopify.com, trailing slashes.
 */
export function normalizeShopDomain(input) {
  if (!input) return null;

  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/$/, '');
  domain = domain.replace(/\.myshopify\.com.*$/, '');
  domain = domain.split('/')[0];
  domain = domain.replace(/[^a-z0-9-]/g, '');

  return domain;
}
