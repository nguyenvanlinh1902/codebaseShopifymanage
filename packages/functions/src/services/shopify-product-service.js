/**
 * Shopify Product Service — read, upsert, update operations.
 * Write primitives (create, bulkVariants, linkImages) live in shopify-product-write-service.js.
 */
import {toGid, fromGid, buildOptionKey, buildVariant} from './shopify-helpers.js';
import {
  createProduct,
  bulkCreateVariantsGraphQL,
  linkVariantImages,
  getProductGraphQL,
  GQL_BATCH
} from './shopify-product-write-service.js';
import {validateGraphqlResult} from '../helpers/graphql-error-handler.js';

export {createProduct, bulkCreateVariantsGraphQL, linkVariantImages, getProductGraphQL};

/**
 * Upsert a product: create if not exists, merge variants if exists.
 * Returns { result, action: 'created' | 'updated', variantStats }
 */
export async function upsertProduct(shopify, productData) {
  let existing = null;
  if (productData.handle) {
    existing = await getProductByHandle(shopify, productData.handle);
  }

  if (!existing) {
    const result = await createProduct(shopify, productData);
    const variantCount = productData.variants?.length || 1;
    return {result, action: 'created', variantStats: {added: variantCount, updated: 0}};
  }

  const numericId = fromGid(existing.id);
  const gid = toGid('Product', numericId);
  const existingProduct = await getProductGraphQL(shopify, numericId);

  const updateInput = {id: gid};
  if (productData.title) updateInput.title = productData.title;
  if (productData.description !== undefined) updateInput.descriptionHtml = productData.description;
  if (productData.vendor) updateInput.vendor = productData.vendor;
  if (productData.productType) updateInput.productType = productData.productType;
  if (productData.tags) updateInput.tags = productData.tags.split(',').map(t => t.trim()).filter(Boolean);
  if (productData.status) updateInput.status = productData.status.toUpperCase();
  if (productData.seoTitle || productData.seoDescription) {
    updateInput.seo = {};
    if (productData.seoTitle) updateInput.seo.title = productData.seoTitle;
    if (productData.seoDescription) updateInput.seo.description = productData.seoDescription;
  }

  // Collect new images (product-level + variant images not already uploaded)
  const existingFns = new Set(
    existingProduct.images.map(img => img.url.split('/').pop().split('?')[0].toLowerCase())
  );
  const newMedia = [];
  for (const img of productData.images || []) {
    const fn = img.src.split('/').pop().split('?')[0].toLowerCase();
    if (!existingFns.has(fn)) {
      newMedia.push({originalSource: img.src, alt: img.alt || undefined, mediaContentType: 'IMAGE'});
    }
  }
  const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
  for (const v of csvVariants) {
    if (v.variantImage) {
      const fn = v.variantImage.split('/').pop().split('?')[0].toLowerCase();
      if (!existingFns.has(fn) && !newMedia.find(m => m.originalSource === v.variantImage)) {
        newMedia.push({originalSource: v.variantImage, mediaContentType: 'IMAGE'});
      }
    }
  }

  const updateMutation = `mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product { id }
      userErrors { field message }
    }
  }`;
  const updateVars = {product: updateInput};
  if (newMedia.length > 0) updateVars.media = newMedia;
  validateGraphqlResult(await shopify.graphql(updateMutation, updateVars), 'productUpdate');

  // Merge variants: match by option key, bulk update existing, bulk create new
  const existingVariants = existingProduct.variants || [];
  let updatedCount = 0;
  const variantUpdates = [];
  const newVariantsToCreate = [];

  for (const csvVariant of csvVariants) {
    const optionKey = buildOptionKey(csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value);
    const match = existingVariants.find(ev =>
      buildOptionKey(ev.option1, ev.option2, ev.option3) === optionKey
    );
    if (match) {
      const upd = {id: toGid('ProductVariant', match.id)};
      if (csvVariant.price) upd.price = csvVariant.price;
      if (csvVariant.compareAtPrice) upd.compareAtPrice = csvVariant.compareAtPrice;
      if (csvVariant.sku || csvVariant.cost) {
        upd.inventoryItem = {};
        if (csvVariant.sku) upd.inventoryItem.sku = csvVariant.sku;
        if (csvVariant.cost) upd.inventoryItem.cost = csvVariant.cost;
      }
      if (csvVariant.barcode) upd.barcode = csvVariant.barcode;
      if (csvVariant.taxable !== undefined) upd.taxable = csvVariant.taxable;
      if (csvVariant.taxCode) upd.taxCode = csvVariant.taxCode;
      variantUpdates.push(upd);
      updatedCount++;
    } else {
      newVariantsToCreate.push(buildVariant(csvVariant));
    }
  }

  if (variantUpdates.length > 0) {
    const bulkUpdateMut = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id }
        userErrors { field message }
      }
    }`;
    for (let i = 0; i < variantUpdates.length; i += GQL_BATCH) {
      validateGraphqlResult(
        await shopify.graphql(bulkUpdateMut, {productId: gid, variants: variantUpdates.slice(i, i + GQL_BATCH)}),
        'productVariantsBulkUpdate'
      );
    }
  }

  let addedCount = 0;
  if (newVariantsToCreate.length > 0) {
    // Shopify limit: 2048 variants per product — check remaining capacity
    const maxNew = 2000 - existingVariants.length;
    const toCreate = maxNew > 0 ? newVariantsToCreate.slice(0, maxNew) : [];
    if (toCreate.length < newVariantsToCreate.length) {
      console.warn(`upsertProduct: "${productData.title}" would exceed 2048 variants (${existingVariants.length} existing + ${newVariantsToCreate.length} new), creating only ${toCreate.length}`);
    }
    if (toCreate.length > 0) {
      const optionNames = [productData.option1Name, productData.option2Name, productData.option3Name].filter(Boolean);
      const created = await bulkCreateVariantsGraphQL(shopify, numericId, toCreate, optionNames);
      addedCount = created.length;
    }
  }

  const updatedProduct = await getProductGraphQL(shopify, numericId);
  await linkVariantImages(shopify, numericId, productData, updatedProduct.variants);

  return {
    result: {id: numericId},
    action: 'updated',
    variantStats: {added: addedCount, updated: updatedCount}
  };
}

/**
 * Update an existing product via GraphQL productUpdate + optional variant update.
 */
export async function updateProduct(shopify, productId, productData) {
  try {
    const gid = toGid('Product', productId);
    const updateInput = {id: gid};

    if (productData.title) updateInput.title = productData.title;
    if (productData.description !== undefined) updateInput.descriptionHtml = productData.description;
    if (productData.vendor) updateInput.vendor = productData.vendor;
    if (productData.productType) updateInput.productType = productData.productType;
    if (productData.tags) updateInput.tags = productData.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (productData.status) updateInput.status = productData.status.toUpperCase();
    if (productData.handle) updateInput.handle = productData.handle;
    if (productData.seoTitle || productData.seoDescription) {
      updateInput.seo = {};
      if (productData.seoTitle) updateInput.seo.title = productData.seoTitle;
      if (productData.seoDescription) updateInput.seo.description = productData.seoDescription;
    }

    const needsVariantUpdate =
      productData.price || productData.compareAtPrice || productData.sku ||
      productData.barcode || productData.taxable !== undefined || productData.cost;

    let newMedia = null;
    if (productData.imageUrl) {
      const existing = await getProductGraphQL(shopify, productId);
      const existingFns = new Set(
        (existing?.images || []).map(img => img.url.split('/').pop().split('?')[0].toLowerCase())
      );
      const fn = productData.imageUrl.split('/').pop().split('?')[0].toLowerCase();
      if (!existingFns.has(fn)) {
        newMedia = [{originalSource: productData.imageUrl, alt: productData.imageAlt || undefined, mediaContentType: 'IMAGE'}];
      }
      if (needsVariantUpdate && existing?.variants?.length > 0) {
        await _updateFirstVariant(shopify, gid, existing.variants[0].id, productData);
      }
    } else if (needsVariantUpdate) {
      const existing = await getProductGraphQL(shopify, productId);
      if (existing?.variants?.length > 0) {
        await _updateFirstVariant(shopify, gid, existing.variants[0].id, productData);
      }
    }

    const updateMut = `mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { id }
        userErrors { field message }
      }
    }`;
    const vars = {product: updateInput};
    if (newMedia) vars.media = newMedia;
    const result = await shopify.graphql(updateMut, vars);

    if (result.productUpdate.userErrors?.length > 0) {
      throw new Error(result.productUpdate.userErrors[0].message);
    }
    return {id: fromGid(result.productUpdate.product.id)};
  } catch (error) {
    console.error('Error updating product:', error);
    throw new Error(`Failed to update product: ${error.message}`);
  }
}

async function _updateFirstVariant(shopify, productGid, variantId, productData) {
  const variantGid = toGid('ProductVariant', variantId);
  const vUpd = {id: variantGid};
  if (productData.price) vUpd.price = productData.price;
  if (productData.compareAtPrice) vUpd.compareAtPrice = productData.compareAtPrice;
  if (productData.sku || productData.cost) {
    vUpd.inventoryItem = {};
    if (productData.sku) vUpd.inventoryItem.sku = productData.sku;
    if (productData.cost) vUpd.inventoryItem.cost = productData.cost;
  }
  if (productData.barcode) vUpd.barcode = productData.barcode;
  if (productData.taxable !== undefined) vUpd.taxable = productData.taxable;

  const varMut = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }`;
  validateGraphqlResult(
    await shopify.graphql(varMut, {productId: productGid, variants: [vUpd]}),
    'productVariantsBulkUpdate'
  );
}

/**
 * Get product by SKU using GraphQL.
 */
export async function getProductBySku(shopify, sku) {
  try {
    const query = `query GetProductBySku($query: String!) {
      productVariants(first: 1, query: $query) {
        edges { node { id sku product { id title handle } } }
      }
    }`;
    const result = await shopify.graphql(query, {query: `sku:${sku}`});
    if (result.productVariants.edges.length > 0) {
      const node = result.productVariants.edges[0].node;
      return {product: node.product, variant: node};
    }
    return null;
  } catch (error) {
    console.error('Error getting product by SKU:', error);
    throw new Error(`Failed to get product by SKU: ${error.message}`);
  }
}

/**
 * Get product by handle using GraphQL.
 */
export async function getProductByHandle(shopify, handle) {
  try {
    const query = `query GetProductByHandle($query: String!) {
      products(first: 1, query: $query) {
        edges { node { id title handle } }
      }
    }`;
    const result = await shopify.graphql(query, {query: `handle:${handle}`});
    if (result.products.edges.length > 0) return result.products.edges[0].node;
    return null;
  } catch (error) {
    console.error('Error getting product by handle:', error);
    throw new Error(`Failed to get product by handle: ${error.message}`);
  }
}

/**
 * Batch fetch variant product info for order line item enrichment.
 * Returns Map<variantId (string), { productUrl, variantImageUrl }>
 */
export async function getLineItemsProductInfo(shopify, variantIds, shopDomain) {
  const result = new Map();
  if (!variantIds || variantIds.length === 0) return result;

  const query = `query GetVariantInfo($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        image { url }
        product { handle featuredImage { url } }
      }
    }
  }`;

  for (let i = 0; i < variantIds.length; i += GQL_BATCH) {
    const gids = variantIds.slice(i, i + GQL_BATCH).map(id => toGid('ProductVariant', id));
    try {
      const gqlResult = await shopify.graphql(query, {ids: gids});
      for (const node of gqlResult?.nodes || []) {
        if (!node?.id) continue;
        const numericId = fromGid(node.id).toString();
        const handle = node.product?.handle;
        const domain = shopDomain?.includes('.') ? shopDomain : `${shopDomain}.myshopify.com`;
        const productUrl = handle && domain ? `https://${domain}/products/${handle}` : '';
        const variantImageUrl = node.image?.url || node.product?.featuredImage?.url || '';
        result.set(numericId, {productUrl, variantImageUrl});
      }
    } catch (err) {
      console.error(`[ShopifyService] getLineItemsProductInfo chunk ${i / GQL_BATCH + 1} failed: ${err.message}`);
    }
  }

  return result;
}
