/**
 * Shopify Product Write Service — create/bulk-variant/image-link mutations.
 */
import {toGid, fromGid, buildMetafieldsFromProduct, buildOptionKey, gqlVariantToRest} from './shopify-helpers.js';

export const GQL_BATCH = 250;

/**
 * Create a product via GraphQL productSet mutation (single call handles product + variants + images).
 */
export async function createProduct(shopify, productData) {
  try {
    const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
    const optionNames = [productData.option1Name, productData.option2Name, productData.option3Name].filter(Boolean);

    const input = {title: productData.title};
    if (productData.description) input.descriptionHtml = productData.description;
    if (productData.vendor) input.vendor = productData.vendor;
    if (productData.productType) input.productType = productData.productType;
    if (productData.handle) input.handle = productData.handle;
    if (productData.giftCard) input.giftCard = true;
    input.status = (productData.status || 'draft').toUpperCase();

    if (productData.tags) {
      input.tags = productData.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (productData.seoTitle || productData.seoDescription) {
      input.seo = {};
      if (productData.seoTitle) input.seo.title = productData.seoTitle;
      if (productData.seoDescription) input.seo.description = productData.seoDescription;
    }

    const metafields = buildMetafieldsFromProduct(productData);
    if (metafields.length > 0) input.metafields = metafields;

    if (optionNames.length > 0) {
      const valueSets = optionNames.map(() => new Set());
      for (const v of csvVariants) {
        if (v.option1Value && optionNames[0]) valueSets[0].add(v.option1Value);
        if (v.option2Value && optionNames[1]) valueSets[1].add(v.option2Value);
        if (v.option3Value && optionNames[2]) valueSets[2].add(v.option3Value);
      }
      input.productOptions = optionNames.map((name, i) => ({
        name,
        values: [...valueSets[i]].map(v => ({name: v}))
      }));
    }

    const allImageUrls = new Set();
    const imagesToUpload = [];
    if (productData.images?.length > 0) {
      for (const img of productData.images) {
        if (img.src && !allImageUrls.has(img.src)) {
          allImageUrls.add(img.src);
          imagesToUpload.push(img);
        }
      }
    } else if (productData.imageUrl) {
      allImageUrls.add(productData.imageUrl);
      imagesToUpload.push({src: productData.imageUrl, alt: productData.imageAlt});
    }
    for (const v of csvVariants) {
      if (v.variantImage && !allImageUrls.has(v.variantImage)) {
        allImageUrls.add(v.variantImage);
        imagesToUpload.push({src: v.variantImage});
      }
    }
    if (imagesToUpload.length > 0) {
      input.files = imagesToUpload.map(img => ({
        originalSource: img.src,
        alt: img.alt || undefined,
        contentType: 'IMAGE'
      }));
    }

    input.variants = csvVariants.map(v => {
      const optVals = [];
      if (v.option1Value && optionNames[0]) optVals.push({optionName: optionNames[0], name: v.option1Value});
      if (v.option2Value && optionNames[1]) optVals.push({optionName: optionNames[1], name: v.option2Value});
      if (v.option3Value && optionNames[2]) optVals.push({optionName: optionNames[2], name: v.option3Value});
      if (optVals.length === 0) optVals.push({optionName: 'Title', name: 'Default Title'});

      const variant = {
        optionValues: optVals,
        price: v.price || '0.00',
        sku: v.sku || '',
        inventoryPolicy: (v.inventoryPolicy || 'deny').toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'DENY',
        inventoryItem: {sku: v.sku || '', tracked: (v.inventoryTracker || 'shopify') === 'shopify'},
        taxable: v.taxable !== undefined ? v.taxable : true
      };
      if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice;
      if (v.barcode) variant.barcode = v.barcode;
      if (v.taxCode) variant.taxCode = v.taxCode;
      if (v.cost) variant.inventoryItem.cost = v.cost;
      if (v.variantImage) variant.file = {originalSource: v.variantImage};
      return variant;
    });

    const mutation = `mutation productSet($input: ProductSetInput!) {
      productSet(input: $input, synchronous: true) {
        product { id variants(first: 10) { edges { node { id } } } }
        userErrors { field message code }
      }
    }`;

    const gqlResult = await shopify.graphql(mutation, {input});
    const payload = gqlResult.productSet;

    if (payload.userErrors?.length > 0) {
      const errs = payload.userErrors.slice(0, 5).map(e => e.message).join('; ');
      console.error('productSet errors:', JSON.stringify(payload.userErrors.slice(0, 10)));
      throw new Error(errs);
    }

    const numericId = fromGid(payload.product.id);
    console.log(`createProduct (productSet): ${numericId} with ${csvVariants.length} variants, ${imagesToUpload.length} images`);
    return {id: numericId, variants: csvVariants.map(() => ({}))};
  } catch (error) {
    console.error('Error creating product:', error);
    throw new Error(`Failed to create product: ${error.message}`);
  }
}

/**
 * Bulk create variants via GraphQL in batches of 250.
 */
export async function bulkCreateVariantsGraphQL(shopify, productId, restVariants, optionNames = []) {
  const gid = String(productId).startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
  const allCreated = [];
  const oNames = [optionNames[0] || 'Title', optionNames[1], optionNames[2]];

  const mutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id title sku selectedOptions { name value } }
        userErrors { field message }
      }
    }`;

  for (let i = 0; i < restVariants.length; i += GQL_BATCH) {
    const batch = restVariants.slice(i, i + GQL_BATCH);
    const gqlVariants = batch.map(v => {
      const optionValues = [];
      if (v.option1 && oNames[0]) optionValues.push({optionName: oNames[0], name: v.option1});
      if (v.option2 && oNames[1]) optionValues.push({optionName: oNames[1], name: v.option2});
      if (v.option3 && oNames[2]) optionValues.push({optionName: oNames[2], name: v.option3});

      const inp = {
        price: v.price || '0.00',
        optionValues,
        inventoryItem: {
          sku: v.sku || '',
          cost: v.cost || undefined,
          tracked: v.inventory_management === 'shopify',
          requiresShipping: v.requires_shipping !== false
        },
        inventoryPolicy: v.inventory_policy === 'continue' ? 'CONTINUE' : 'DENY'
      };
      if (v.compare_at_price) inp.compareAtPrice = v.compare_at_price;
      if (v.barcode) inp.barcode = v.barcode;
      if (v.taxable !== undefined) inp.taxable = v.taxable;
      if (v.tax_code) inp.taxCode = v.tax_code;
      return inp;
    });

    try {
      const result = await shopify.graphql(mutation, {productId: gid, variants: gqlVariants});
      const payload = result.productVariantsBulkCreate;
      if (payload.userErrors?.length > 0) {
        console.warn(`GraphQL variantsBulkCreate errors (batch ${i / GQL_BATCH + 1}): ${JSON.stringify(payload.userErrors.slice(0, 5))}`);
      }
      if (payload.productVariants) {
        for (const gv of payload.productVariants) {
          const numId = gv.id.replace('gid://shopify/ProductVariant/', '');
          const opts = gv.selectedOptions || [];
          allCreated.push({
            id: parseInt(numId),
            sku: gv.sku || '',
            option1: opts[0]?.value || null,
            option2: opts[1]?.value || null,
            option3: opts[2]?.value || null
          });
        }
      }
      console.log(`GraphQL variantsBulkCreate batch ${i / GQL_BATCH + 1}: ${payload.productVariants?.length || 0} created`);
    } catch (err) {
      console.error(`GraphQL variantsBulkCreate batch ${i / GQL_BATCH + 1} failed: ${err.message}`);
    }
  }

  console.log(`bulkCreateVariantsGraphQL: ${allCreated.length}/${restVariants.length} created for product ${productId}`);
  return allCreated;
}

/**
 * Link variant images using GraphQL bulk update.
 * Queries product media, matches by filename, then bulk-updates variant mediaId.
 */
export async function linkVariantImages(shopify, productId, productData, createdVariants) {
  const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
  const variantsWithImages = csvVariants.filter(v => v.variantImage);
  if (variantsWithImages.length === 0) return;

  const gid = toGid('Product', productId);
  const mediaQuery = `query productMedia($id: ID!) {
    product(id: $id) {
      media(first: 250) {
        edges { node { id ... on MediaImage { image { url } } } }
      }
    }
  }`;

  let mediaEdges = [];
  try {
    const mediaResult = await shopify.graphql(mediaQuery, {id: gid});
    mediaEdges = mediaResult?.product?.media?.edges || [];
  } catch (err) {
    console.error(`linkVariantImages: failed to query media: ${err.message}`);
    return;
  }
  if (mediaEdges.length === 0) return;

  const filenameToMediaGid = {};
  for (const edge of mediaEdges) {
    const imageUrl = edge.node?.image?.url;
    if (imageUrl) {
      filenameToMediaGid[imageUrl.split('/').pop().split('?')[0].toLowerCase()] = edge.node.id;
    }
  }

  const optionKeyToVariantId = {};
  const skuToVariantId = {};
  for (const v of createdVariants) {
    optionKeyToVariantId[buildOptionKey(v.option1, v.option2, v.option3)] = v.id;
    if (v.sku) skuToVariantId[v.sku] = v.id;
  }

  const updates = [];
  for (const csvVariant of variantsWithImages) {
    const fn = csvVariant.variantImage.split('/').pop().split('?')[0].toLowerCase();
    const mediaGid = filenameToMediaGid[fn];
    if (!mediaGid) continue;
    const csvKey = buildOptionKey(csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value);
    let variantId = optionKeyToVariantId[csvKey];
    if (!variantId && csvVariant.sku) variantId = skuToVariantId[csvVariant.sku];
    if (!variantId) continue;
    updates.push({id: toGid('ProductVariant', variantId), mediaId: mediaGid});
  }
  if (updates.length === 0) return;

  const mutation = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }`;

  let linkedCount = 0;
  for (let i = 0; i < updates.length; i += GQL_BATCH) {
    try {
      const result = await shopify.graphql(mutation, {productId: gid, variants: updates.slice(i, i + GQL_BATCH)});
      linkedCount += result.productVariantsBulkUpdate.productVariants?.length || 0;
    } catch (err) {
      console.error(`linkVariantImages batch failed: ${err.message}`);
    }
  }
  console.log(`linkVariantImages: linked ${linkedCount}/${variantsWithImages.length}`);
}

/**
 * Fetch product with all variants via GraphQL (auto-paginated).
 * Returns {id, variants: [{id, sku, option1, option2, option3}], images: [{url, src}]}
 */
export async function getProductGraphQL(shopify, productId) {
  const gid = toGid('Product', productId);
  const query = `query getProduct($id: ID!, $after: String) {
    product(id: $id) {
      id
      variants(first: 250, after: $after) {
        edges { node { id sku selectedOptions { name value } } }
        pageInfo { hasNextPage endCursor }
      }
      media(first: 250) {
        edges { node { id ... on MediaImage { image { url } } } }
      }
    }
  }`;

  const result = await shopify.graphql(query, {id: gid});
  if (!result.product) return null;

  const variants = result.product.variants.edges.map(e => gqlVariantToRest(e.node));
  let pageInfo = result.product.variants.pageInfo;

  while (pageInfo.hasNextPage) {
    const next = await shopify.graphql(query, {id: gid, after: pageInfo.endCursor});
    variants.push(...next.product.variants.edges.map(e => gqlVariantToRest(e.node)));
    pageInfo = next.product.variants.pageInfo;
  }

  const images = result.product.media.edges
    .filter(e => e.node?.image?.url)
    .map(e => ({url: e.node.image.url, src: e.node.image.url}));

  return {id: fromGid(result.product.id), variants, images};
}
