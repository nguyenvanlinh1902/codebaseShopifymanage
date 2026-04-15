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
            id tracked requiresShipping countryCodeOfOrigin harmonizedSystemCode
            measurement { weight { value unit } }
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

  // Metafields are persisted separately via metafieldsSet after productUpdate.
  const metafieldsToSet = Array.isArray(formData.metafields)
    ? formData.metafields
        .filter(m => m && m.namespace && m.key && m.value !== '' && m.value !== null && m.value !== undefined)
        .map(m => {
          const type = (typeof m.type === 'object' && m.type !== null ? m.type.name : m.type) || 'single_line_text_field';
          return {ownerId: gid, namespace: m.namespace, key: m.key, type, value: normalizeMetafieldValue(type, m.value)};
        })
        .filter(m => m.value !== null)
    : [];

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
      const invItem = buildInventoryItemInput(v, {includeSkuEmpty: true});
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
      const invItem = buildInventoryItemInput(v);
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

  // Persist metafields via metafieldsSet (upserts by ownerId+namespace+key, max 25 per call).
  if (metafieldsToSet.length > 0) {
    const setMutation = `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key }
        userErrors { field message code }
      }
    }`;
    const CHUNK = 25;
    for (let i = 0; i < metafieldsToSet.length; i += CHUNK) {
      const chunk = metafieldsToSet.slice(i, i + CHUNK);
      const r = await shopify.graphql(setMutation, {metafields: chunk});
      const errs = r?.metafieldsSet?.userErrors || [];
      if (errs.length > 0) throw new Error(errs.map(e => `${(e.field || []).join('.')}: ${e.message}`).join('; '));
    }
  }

  // Sync collection membership (productUpdate does not accept collections).
  if (Array.isArray(formData.collections)) {
    const current = await getProductCollections(shopify, productId);
    const currentIds = new Set(current.map(c => c.id));
    const desiredIds = new Set(
      formData.collections.map(c => (c && (c.id || c))).filter(Boolean)
    );
    const toAdd = [...desiredIds].filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !desiredIds.has(id));

    const addMutation = `mutation collectionAddProductsV2($id: ID!, $productIds: [ID!]!) {
      collectionAddProductsV2(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`;
    const removeMutation = `mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`;

    for (const cid of toAdd) {
      const r = await shopify.graphql(addMutation, {id: cid, productIds: [gid]});
      const errs = r?.collectionAddProductsV2?.userErrors || [];
      if (errs.length > 0) throw new Error(errs.map(e => e.message).join('; '));
    }
    for (const cid of toRemove) {
      const r = await shopify.graphql(removeMutation, {id: cid, productIds: [gid]});
      const errs = r?.collectionRemoveProducts?.userErrors || [];
      // Smart (auto) collections reject manual removal — skip those, throw on others.
      const hard = errs.filter(e => !/smart|automated/i.test(e.message || ''));
      if (hard.length > 0) throw new Error(hard.map(e => e.message).join('; '));
    }
  }

  // Sync media (productUpdate does not manage media). Handle create/delete/reorder/alt.
  if (Array.isArray(formData.media)) {
    await syncProductMedia(shopify, gid, productId, formData.media);
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

  // Sync on-hand inventory quantities for existing variants (new variants require a
  // follow-up fetch for their inventoryItem ids, handled on the client's next reload).
  await syncVariantInventory(shopify, allVariants.filter(v => v.id && !v._delete));

  return {id: fromGid(updatePayload.product.id)};
}

/** Map UI variant → InventoryItemInput (sku, tracked, cost, weight, country, HS). */
function buildInventoryItemInput(v, {includeSkuEmpty = false} = {}) {
  const inv = {};
  if (includeSkuEmpty ? v.sku !== undefined : !!v.sku) inv.sku = v.sku || '';
  if (v.inventoryItem?.tracked !== undefined) inv.tracked = !!v.inventoryItem.tracked;
  const cost = v.inventoryItem?.cost ?? v.cost;
  if (cost !== undefined && cost !== '' && cost !== null) inv.cost = String(cost);
  if (v.requiresShipping !== undefined) inv.requiresShipping = !!v.requiresShipping;
  const weightRaw = v.weight ?? v.inventoryItem?.measurement?.weight?.value;
  const weightNum = Number(weightRaw);
  if (Number.isFinite(weightNum) && weightNum > 0) {
    inv.measurement = {
      weight: {
        value: weightNum,
        unit: normalizeWeightUnit(v.weightUnit || v.inventoryItem?.measurement?.weight?.unit)
      }
    };
  }
  const coo = v.countryCodeOfOrigin || v.inventoryItem?.countryCodeOfOrigin;
  if (coo) inv.countryCodeOfOrigin = String(coo).toUpperCase();
  const hs = v.harmonizedSystemCode || v.inventoryItem?.harmonizedSystemCode;
  if (hs) inv.harmonizedSystemCode = String(hs);
  return inv;
}

function normalizeWeightUnit(raw) {
  const s = String(raw || 'POUNDS').toUpperCase();
  if (['LB', 'LBS', 'POUND', 'POUNDS'].includes(s)) return 'POUNDS';
  if (['KG', 'KGS', 'KILOGRAM', 'KILOGRAMS'].includes(s)) return 'KILOGRAMS';
  if (['G', 'GRAM', 'GRAMS'].includes(s)) return 'GRAMS';
  if (['OZ', 'OUNCE', 'OUNCES'].includes(s)) return 'OUNCES';
  return 'POUNDS';
}

/** Sync on-hand inventory quantities for variants with an `inventory` map. */
async function syncVariantInventory(shopify, variants) {
  const desired = [];
  for (const v of variants) {
    const itemId = v.inventoryItemId || v.inventoryItem?.id;
    if (!itemId || !v.inventory || typeof v.inventory !== 'object') continue;
    for (const [locationId, qty] of Object.entries(v.inventory)) {
      if (!locationId) continue;
      const n = parseInt(qty, 10);
      if (!Number.isFinite(n)) continue;
      desired.push({inventoryItemId: itemId, locationId, quantity: n});
    }
  }
  if (desired.length === 0) return;

  // Fetch current on_hand for each (item, location) so we can supply changeFromQuantity.
  const aliasFields = desired
    .map((d, i) => `q${i}: inventoryItem(id: "${d.inventoryItemId}") {
      inventoryLevel(locationId: "${d.locationId}") {
        quantities(names: ["on_hand"]) { name quantity }
      }
    }`)
    .join('\n');
  const currentRes = await shopify.graphql(`query { ${aliasFields} }`);
  const quantities = desired.map((d, i) => {
    const level = currentRes?.[`q${i}`]?.inventoryLevel;
    const current = level?.quantities?.find(q => q.name === 'on_hand')?.quantity ?? 0;
    return {
      inventoryItemId: d.inventoryItemId,
      locationId: d.locationId,
      quantity: d.quantity,
      compareQuantity: current
    };
  }).filter(q => q.quantity !== q.compareQuantity);

  if (quantities.length === 0) return;

  const r = await shopify.graphql(
    `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {input: {name: 'on_hand', reason: 'correction', quantities}}
  );
  const errs = r?.inventorySetQuantities?.userErrors || [];
  if (errs.length > 0) throw new Error(errs.map(e => e.message).join('; '));
}

/**
 * Normalize metafield value by type. Returns null to skip invalid values
 * (e.g. measurement types that need a stringified {value, unit} JSON).
 */
function normalizeMetafieldValue(type, raw) {
  const defaultUnit = {dimension: 'CENTIMETERS', weight: 'GRAMS', volume: 'LITERS'};
  if (defaultUnit[type]) {
    // Accept {value, unit} object, a JSON string of the same, or a plain number string.
    let parsed = typeof raw === 'object' && raw !== null ? raw : null;
    if (!parsed && typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    }
    if (parsed && parsed.value !== undefined && parsed.unit) {
      const v = Number(parsed.value);
      if (Number.isFinite(v)) return JSON.stringify({value: v, unit: String(parsed.unit)});
    }
    const n = Number(raw);
    if (Number.isFinite(n)) return JSON.stringify({value: n, unit: defaultUnit[type]});
    return null;
  }
  return String(raw);
}

/**
 * Sync product media: create new uploads, delete removed, update alt text, reorder.
 * `desired` is the full desired list in order. New entries have no `id` but have `url`
 * (the staged upload resourceUrl returned by stagedUploadsCreate).
 */
async function syncProductMedia(shopify, gid, productId, desired) {
  const current = await getProductMediaList(shopify, productId);
  const currentById = new Map(current.map(m => [m.id, m]));
  const desiredIds = new Set(desired.filter(m => m.id).map(m => m.id));

  // Delete removed
  const toDelete = current.filter(m => !desiredIds.has(m.id)).map(m => m.id);
  if (toDelete.length > 0) {
    const r = await shopify.graphql(
      `mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          mediaUserErrors { field message }
        }
      }`,
      {productId: gid, mediaIds: toDelete}
    );
    const errs = r?.productDeleteMedia?.mediaUserErrors || [];
    if (errs.length > 0) throw new Error(errs.map(e => e.message).join('; '));
  }

  // Create new (entries without id but with url from staged upload)
  const toCreate = desired
    .filter(m => !m.id && m.url)
    .map(m => ({
      originalSource: m.url,
      alt: m.alt || '',
      mediaContentType: m.mediaContentType || 'IMAGE'
    }));
  let createdIds = [];
  if (toCreate.length > 0) {
    const r = await shopify.graphql(
      `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media { id alt mediaContentType status }
          mediaUserErrors { field message }
        }
      }`,
      {productId: gid, media: toCreate}
    );
    const errs = r?.productCreateMedia?.mediaUserErrors || [];
    if (errs.length > 0) throw new Error(errs.map(e => e.message).join('; '));
    createdIds = (r?.productCreateMedia?.media || []).map(m => m.id);
  }

  // Update alt text for existing media whose alt changed
  const altUpdates = desired
    .filter(m => m.id && currentById.has(m.id))
    .filter(m => (m.alt || '') !== (currentById.get(m.id).alt || ''))
    .map(m => ({id: m.id, alt: m.alt || ''}));
  if (altUpdates.length > 0) {
    const r = await shopify.graphql(
      `mutation productUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
        productUpdateMedia(productId: $productId, media: $media) {
          mediaUserErrors { field message }
        }
      }`,
      {productId: gid, media: altUpdates}
    );
    const errs = r?.productUpdateMedia?.mediaUserErrors || [];
    if (errs.length > 0) throw new Error(errs.map(e => e.message).join('; '));
  }

  // Reorder — build final id list in desired order, substituting created ids for new entries
  let createdIdx = 0;
  const finalIds = desired
    .map(m => (m.id ? m.id : createdIds[createdIdx++]))
    .filter(Boolean);
  if (finalIds.length > 1) {
    const moves = finalIds.map((id, i) => ({id, newPosition: String(i)}));
    const r = await shopify.graphql(
      `mutation productReorderMedia($id: ID!, $moves: [MoveInput!]!) {
        productReorderMedia(id: $id, moves: $moves) {
          mediaUserErrors { field message }
        }
      }`,
      {id: gid, moves}
    );
    const errs = r?.productReorderMedia?.mediaUserErrors || [];
    // Reorder can fail for freshly-created media still processing — warn but don't fail the save.
    if (errs.length > 0 && !errs.every(e => /processing|not ready/i.test(e.message || ''))) {
      throw new Error(errs.map(e => e.message).join('; '));
    }
  }
}

async function getProductMediaList(shopify, productId) {
  const gid = toGid('Product', productId);
  const result = await shopify.graphql(
    `query productMedia($id: ID!) {
      product(id: $id) {
        media(first: 250) { nodes { id alt mediaContentType } }
      }
    }`,
    {id: gid}
  );
  return result?.product?.media?.nodes || [];
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

