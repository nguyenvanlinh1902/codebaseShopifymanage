/**
 * Shopify Product Detail Service — fetch/update/delete a single product and related data.
 */
import {toGid, fromGid} from './shopify-helpers.js';

/** Fetch full product including variants (auto-paginated), media, metafields, options. */
export async function getFullProduct(shopify, productId) {
  const gid = toGid('Product', productId);
  const query = `query getFullProduct($id: ID!, $after: String) {
    product(id: $id) {
      id title descriptionHtml vendor productType tags status handle templateSuffix
      seo { title description }
      options { id name values optionValues { id name } }
      category { id name }
      metafields(first: 50) {
        nodes {
          id namespace key value type
          definition { id name }
        }
      }
      media(first: 250) {
        nodes {
          id alt mediaContentType
          ... on MediaImage { image { url width height } }
        }
      }
      variants(first: 250, after: $after) {
        nodes {
          id title sku price compareAtPrice barcode
          selectedOptions { name value }
          inventoryItem {
            id tracked
            inventoryLevels(first: 20) {
              nodes {
                location { id name }
                quantities(names: ["available"]) { name quantity }
              }
            }
          }
          image { url }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

  const result = await shopify.graphql(query, {id: gid});
  if (!result?.product) return null;

  const product = {...result.product};
  const variants = [...(product.variants?.nodes || [])];
  let pageInfo = product.variants?.pageInfo;

  while (pageInfo?.hasNextPage) {
    const next = await shopify.graphql(query, {id: gid, after: pageInfo.endCursor});
    variants.push(...(next.product?.variants?.nodes || []));
    pageInfo = next.product?.variants?.pageInfo;
  }

  product.variants = variants;
  product.metafields = product.metafields?.nodes || [];
  product.media = product.media?.nodes || [];
  return product;
}

/** Get collections a product belongs to. */
export async function getProductCollections(shopify, productId) {
  const gid = toGid('Product', productId);
  const result = await shopify.graphql(
    `query productCollections($id: ID!) {
      product(id: $id) {
        collections(first: 50) {
          nodes { id title }
        }
      }
    }`,
    {id: gid}
  );
  return result?.product?.collections?.nodes || [];
}

/** Get sales channel publication status for a product. */
export async function getProductPublications(shopify, productId) {
  const gid = toGid('Product', productId);
  const result = await shopify.graphql(
    `query productPublications($id: ID!) {
      product(id: $id) {
        resourcePublicationsV2(first: 20) {
          nodes {
            publication { id name }
            isPublished
          }
        }
      }
    }`,
    {id: gid}
  );
  const nodes = result?.product?.resourcePublicationsV2?.nodes || [];
  return nodes.map(n => ({
    id: n.publication?.id,
    name: n.publication?.name,
    isPublished: n.isPublished
  }));
}

/**
 * Update a product via productUpdate + productVariantsBulkUpdate.
 * Avoids productSet because productSet treats variants as a "set" operation — any variant without
 * a matching id is re-created, which counts against Shopify's daily variant-creation limit.
 */
export async function updateProduct(shopify, productId, formData) {
  const gid = toGid('Product', productId);
  const input = {id: gid};

  if (formData.title !== undefined) input.title = formData.title;
  if (formData.descriptionHtml !== undefined) input.descriptionHtml = formData.descriptionHtml;
  if (formData.vendor !== undefined) input.vendor = formData.vendor;
  if (formData.productType !== undefined) input.productType = formData.productType;
  if (formData.handle !== undefined) input.handle = formData.handle;
  if (formData.status !== undefined) input.status = formData.status.toUpperCase();
  if (formData.tags !== undefined) {
    input.tags = Array.isArray(formData.tags)
      ? formData.tags
      : formData.tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  const seo = formData.seo || {};
  if (formData.seoTitle || formData.seoDescription || seo.title || seo.description) {
    input.seo = {};
    const sTitle = formData.seoTitle || seo.title;
    const sDesc = formData.seoDescription || seo.description;
    if (sTitle) input.seo.title = sTitle;
    if (sDesc) input.seo.description = sDesc;
  }
  if (formData.templateSuffix !== undefined) input.templateSuffix = formData.templateSuffix;

  // Sanitize metafields: drop UI-only fields like `definition`, `id`, and empty values
  if (Array.isArray(formData.metafields)) {
    input.metafields = formData.metafields
      .filter(m => m && m.namespace && m.key && m.value !== '' && m.value !== null && m.value !== undefined)
      .map(m => ({
        namespace: m.namespace,
        key: m.key,
        type: m.type || 'single_line_text_field',
        value: String(m.value)
      }));
  }

  const allVariants = Array.isArray(formData.variants) ? formData.variants : [];
  const variantUpdates = allVariants
    .filter(v => v.id && !v._delete)
    .map(v => {
      const out = {id: v.id};
      if (v.price !== undefined && v.price !== '') out.price = String(v.price);
      if (v.compareAtPrice !== undefined && v.compareAtPrice !== '' && v.compareAtPrice !== null) {
        out.compareAtPrice = String(v.compareAtPrice);
      }
      if (v.barcode !== undefined) out.barcode = v.barcode || null;
      if (v.taxable !== undefined) out.taxable = !!v.taxable;
      if (v.inventoryPolicy) {
        out.inventoryPolicy = String(v.inventoryPolicy).toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'DENY';
      }
      const invItem = {};
      if (v.sku !== undefined) invItem.sku = v.sku || '';
      if (v.inventoryItem?.tracked !== undefined) invItem.tracked = !!v.inventoryItem.tracked;
      if (Object.keys(invItem).length > 0) out.inventoryItem = invItem;
      return out;
    });

  const variantCreates = allVariants
    .filter(v => !v.id && !v._delete)
    .map(v => {
      const optionValues = Object.entries(v.optionValues || {})
        .filter(([name, value]) => name && value)
        .map(([name, value]) => ({optionName: name, name: String(value)}));
      if (optionValues.length === 0) return null;
      const out = {optionValues};
      if (v.price !== undefined && v.price !== '') out.price = String(v.price);
      if (v.compareAtPrice) out.compareAtPrice = String(v.compareAtPrice);
      if (v.barcode) out.barcode = v.barcode;
      if (v.taxable !== undefined) out.taxable = !!v.taxable;
      if (v.inventoryPolicy) {
        out.inventoryPolicy = String(v.inventoryPolicy).toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'DENY';
      }
      const invItem = {};
      if (v.sku) invItem.sku = v.sku;
      if (v.inventoryItem?.tracked !== undefined) invItem.tracked = !!v.inventoryItem.tracked;
      if (Object.keys(invItem).length > 0) out.inventoryItem = invItem;
      return out;
    })
    .filter(Boolean);

  const variantDeletes = allVariants.filter(v => v.id && v._delete).map(v => v.id);

  const productUpdateMutation = `mutation productUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id }
      userErrors { field message }
    }
  }`;

  const updateResult = await shopify.graphql(productUpdateMutation, {product: input});
  const updatePayload = updateResult?.productUpdate;
  if (updatePayload?.userErrors?.length > 0) {
    throw new Error(updatePayload.userErrors.map(e => e.message).join('; '));
  }

  // Bulk update variants separately — this does not count against the variant-creation quota.
  if (variantUpdates.length > 0) {
    const bulkMutation = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`;
    const CHUNK = 100;
    for (let i = 0; i < variantUpdates.length; i += CHUNK) {
      const chunk = variantUpdates.slice(i, i + CHUNK);
      const bulkResult = await shopify.graphql(bulkMutation, {productId: gid, variants: chunk});
      const bulkPayload = bulkResult?.productVariantsBulkUpdate;
      if (bulkPayload?.userErrors?.length > 0) {
        throw new Error(bulkPayload.userErrors.map(e => e.message).join('; '));
      }
    }
  }

  if (variantCreates.length > 0) {
    const createMutation = `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        productVariants { id }
        userErrors { field message code }
      }
    }`;
    const CHUNK = 100;
    for (let i = 0; i < variantCreates.length; i += CHUNK) {
      const chunk = variantCreates.slice(i, i + CHUNK);
      const createResult = await shopify.graphql(createMutation, {
        productId: gid,
        variants: chunk,
        strategy: 'REMOVE_STANDALONE_VARIANT'
      });
      const createPayload = createResult?.productVariantsBulkCreate;
      if (createPayload?.userErrors?.length > 0) {
        throw new Error(createPayload.userErrors.map(e => e.message).join('; '));
      }
    }
  }

  if (variantDeletes.length > 0) {
    const deleteMutation = `mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
      productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
        userErrors { field message }
      }
    }`;
    const deleteResult = await shopify.graphql(deleteMutation, {productId: gid, variantsIds: variantDeletes});
    const deletePayload = deleteResult?.productVariantsBulkDelete;
    if (deletePayload?.userErrors?.length > 0) {
      throw new Error(deletePayload.userErrors.map(e => e.message).join('; '));
    }
  }

  return {id: fromGid(updatePayload.product.id)};
}

/** Delete a product. */
export async function deleteProduct(shopify, productId) {
  const gid = toGid('Product', productId);
  const result = await shopify.graphql(
    `mutation productDelete($id: ID!) {
      productDelete(input: {id: $id}) {
        deletedProductId
        userErrors { field message }
      }
    }`,
    {id: gid}
  );
  const payload = result?.productDelete;
  if (payload?.userErrors?.length > 0) {
    throw new Error(payload.userErrors.map(e => e.message).join('; '));
  }
  return {deletedId: productId};
}

