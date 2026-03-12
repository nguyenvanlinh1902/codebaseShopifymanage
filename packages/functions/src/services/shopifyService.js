import Shopify from 'shopify-api-node';
import shopifyConfig from '../config/shopify.js';

/**
 * Shopify Service
 * Handles all interactions with Shopify API
 */
export class ShopifyService {
  constructor(shopConfig) {
    if (shopConfig) {
      this.shopify = new Shopify({
        shopName: shopConfig.shopDomain,
        accessToken: shopConfig.accessToken,
        apiVersion: shopConfig.apiVersion || shopifyConfig.apiVersion || '2026-01',
        autoLimit: { calls: 2, interval: 1000, bucketSize: 35 },
        timeout: 180000 // 3 min - products with many variants/images need more time
      });
      this.shopDomain = shopConfig.shopDomain;
    }
  }

  static toGid(type, id) {
    return String(id).startsWith('gid://') ? id : `gid://shopify/${type}/${id}`;
  }

  static fromGid(gid) {
    return parseInt(gid.replace(/^gid:\/\/shopify\/\w+\//, ''));
  }

  /**
   * Build metafields array from product data.
   * Maps CSV-parsed fields to Shopify metafield format.
   */
  static buildMetafieldsFromProduct(productData) {
    // Dynamic metafields auto-detected from CSV headers (product.metafields.{namespace}.{key})
    // No need to hardcode each metafield - just add a new column to CSV and it works
    if (!productData.dynamicMetafields || productData.dynamicMetafields.length === 0) {
      return [];
    }
    return productData.dynamicMetafields;
  }

  /**
   * Build a Shopify variant object from variant data
   */
  static buildVariant(variantData) {
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
   * Create a product in Shopify via GraphQL productSet mutation.
   * Single API call handles product + ALL variants + images + variant-image links.
   */
  async createProduct(productData) {
    try {
      const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
      const optionNames = [productData.option1Name, productData.option2Name, productData.option3Name].filter(Boolean);

      // Build ProductSetInput
      const input = { title: productData.title };
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

      const metafields = ShopifyService.buildMetafieldsFromProduct(productData);
      if (metafields.length > 0) input.metafields = metafields;

      // Build product options with unique values from variants
      if (optionNames.length > 0) {
        const valueSets = optionNames.map(() => new Set());
        for (const v of csvVariants) {
          if (v.option1Value && optionNames[0]) valueSets[0].add(v.option1Value);
          if (v.option2Value && optionNames[1]) valueSets[1].add(v.option2Value);
          if (v.option3Value && optionNames[2]) valueSets[2].add(v.option3Value);
        }
        input.productOptions = optionNames.map((name, i) => ({
          name,
          values: [...valueSets[i]].map(v => ({ name: v }))
        }));
      }

      // Collect all unique image URLs (product images + variant images)
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
        imagesToUpload.push({ src: productData.imageUrl, alt: productData.imageAlt });
      }
      for (const v of csvVariants) {
        if (v.variantImage && !allImageUrls.has(v.variantImage)) {
          allImageUrls.add(v.variantImage);
          imagesToUpload.push({ src: v.variantImage });
        }
      }
      if (imagesToUpload.length > 0) {
        input.files = imagesToUpload.map(img => ({
          originalSource: img.src,
          alt: img.alt || undefined,
          contentType: 'IMAGE'
        }));
      }

      // Build variants with option values and image links
      input.variants = csvVariants.map(v => {
        const optVals = [];
        if (v.option1Value && optionNames[0]) optVals.push({ optionName: optionNames[0], name: v.option1Value });
        if (v.option2Value && optionNames[1]) optVals.push({ optionName: optionNames[1], name: v.option2Value });
        if (v.option3Value && optionNames[2]) optVals.push({ optionName: optionNames[2], name: v.option3Value });
        if (optVals.length === 0) optVals.push({ optionName: 'Title', name: 'Default Title' });

        const variant = {
          optionValues: optVals,
          price: v.price || '0.00',
          sku: v.sku || '',
          inventoryPolicy: (v.inventoryPolicy || 'deny').toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'DENY',
          inventoryItem: { sku: v.sku || '', tracked: (v.inventoryTracker || 'shopify') === 'shopify' },
          taxable: v.taxable !== undefined ? v.taxable : true
        };
        if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice;
        if (v.barcode) variant.barcode = v.barcode;
        if (v.taxCode) variant.taxCode = v.taxCode;
        if (v.cost) variant.inventoryItem.cost = v.cost;
        if (v.variantImage) variant.file = { originalSource: v.variantImage };

        return variant;
      });

      const mutation = `mutation productSet($input: ProductSetInput!) {
        productSet(input: $input, synchronous: true) {
          product { id variants(first: 10) { edges { node { id } } } }
          userErrors { field message code }
        }
      }`;

      const gqlResult = await this.shopify.graphql(mutation, { input });
      const payload = gqlResult.productSet;

      if (payload.userErrors?.length > 0) {
        const errs = payload.userErrors.slice(0, 5).map(e => e.message).join('; ');
        console.error('productSet errors:', JSON.stringify(payload.userErrors.slice(0, 10)));
        throw new Error(errs);
      }

      const numericId = ShopifyService.fromGid(payload.product.id);
      console.log(`createProduct (productSet): ${numericId} with ${csvVariants.length} variants, ${imagesToUpload.length} images`);

      return { id: numericId, variants: csvVariants.map(() => ({})) };
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  /**
   * Build normalized option key for variant matching.
   * Shopify auto-assigns "Default Title" to single-variant products with no options,
   * so we normalize it to empty string for consistent matching with CSV data.
   */
  static buildOptionKey(option1, option2, option3) {
    const normalize = v => (!v || v === 'Default Title') ? '' : v;
    return [normalize(option1), normalize(option2), normalize(option3)].join('|');
  }

  /**
   * Bulk create variants via GraphQL API.
   * REST API cannot add variants when product already has 100+ variants.
   * Batches in chunks of 250 to stay within GraphQL limits.
   * Returns array of created variant objects {id, sku, option1, option2, option3}.
   */
  async _bulkCreateVariantsGraphQL(productId, restVariants, optionNames = []) {
    const GQL_BATCH = 250;
    const gid = String(productId).startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
    const allCreated = [];

    const mutation = `
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { id title sku selectedOptions { name value } }
          userErrors { field message }
        }
      }`;

    // Map REST option keys (option1/option2/option3) to real option names
    const oNames = [optionNames[0] || 'Title', optionNames[1], optionNames[2]];

    for (let i = 0; i < restVariants.length; i += GQL_BATCH) {
      const batch = restVariants.slice(i, i + GQL_BATCH);

      const gqlVariants = batch.map(v => {
        const optionValues = [];
        if (v.option1 && oNames[0]) optionValues.push({ optionName: oNames[0], name: v.option1 });
        if (v.option2 && oNames[1]) optionValues.push({ optionName: oNames[1], name: v.option2 });
        if (v.option3 && oNames[2]) optionValues.push({ optionName: oNames[2], name: v.option3 });

        const input = {
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
        if (v.compare_at_price) input.compareAtPrice = v.compare_at_price;
        if (v.barcode) input.barcode = v.barcode;
        if (v.taxable !== undefined) input.taxable = v.taxable;
        if (v.tax_code) input.taxCode = v.tax_code;

        return input;
      });

      try {
        const result = await this.shopify.graphql(mutation, { productId: gid, variants: gqlVariants });
        const payload = result.productVariantsBulkCreate;

        if (payload.userErrors && payload.userErrors.length > 0) {
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

    console.log(`_bulkCreateVariantsGraphQL: ${allCreated.length}/${restVariants.length} created for product ${productId}`);
    return allCreated;
  }

  /**
   * Link variant images using GraphQL bulk update.
   * Queries product media, matches by filename, then bulk updates in batches of 250.
   * Used only for upsert-update path (createProduct uses productSet with file).
   */
  async _linkVariantImages(productId, productData, createdVariants) {
    const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
    const variantsWithImages = csvVariants.filter(v => v.variantImage);
    if (variantsWithImages.length === 0) return;

    const gid = ShopifyService.toGid('Product', productId);

    // Query product media to build filename → mediaGid map
    const mediaQuery = `query productMedia($id: ID!) {
      product(id: $id) {
        media(first: 250) {
          edges { node { id ... on MediaImage { image { url } } } }
        }
      }
    }`;

    let mediaEdges = [];
    try {
      const mediaResult = await this.shopify.graphql(mediaQuery, { id: gid });
      mediaEdges = mediaResult?.product?.media?.edges || [];
    } catch (err) {
      console.error(`_linkVariantImages: failed to query media: ${err.message}`);
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

    // Build variant lookup maps (option key primary, SKU fallback)
    const optionKeyToVariantId = {};
    const skuToVariantId = {};
    for (const v of createdVariants) {
      optionKeyToVariantId[ShopifyService.buildOptionKey(v.option1, v.option2, v.option3)] = v.id;
      if (v.sku) skuToVariantId[v.sku] = v.id;
    }

    // Match variants to media by filename
    const updates = [];
    for (const csvVariant of variantsWithImages) {
      const fn = csvVariant.variantImage.split('/').pop().split('?')[0].toLowerCase();
      const mediaGid = filenameToMediaGid[fn];
      if (!mediaGid) continue;

      const csvKey = ShopifyService.buildOptionKey(
        csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value
      );
      let variantId = optionKeyToVariantId[csvKey];
      if (!variantId && csvVariant.sku) variantId = skuToVariantId[csvVariant.sku];
      if (!variantId) continue;

      updates.push({ id: ShopifyService.toGid('ProductVariant', variantId), mediaId: mediaGid });
    }

    if (updates.length === 0) return;

    // Batch update via GraphQL
    const mutation = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id }
        userErrors { field message }
      }
    }`;

    let linkedCount = 0;
    for (let i = 0; i < updates.length; i += 250) {
      try {
        const result = await this.shopify.graphql(mutation, { productId: gid, variants: updates.slice(i, i + 250) });
        linkedCount += result.productVariantsBulkUpdate.productVariants?.length || 0;
      } catch (err) {
        console.error(`_linkVariantImages batch failed: ${err.message}`);
      }
    }

    console.log(`_linkVariantImages: linked ${linkedCount}/${variantsWithImages.length}`);
  }

  /**
   * Fetch product with all variants via GraphQL (paginated).
   * Returns {id, variants: [{id, sku, option1, option2, option3}], images: [{url}]}
   */
  async _getProductGraphQL(productId) {
    const gid = ShopifyService.toGid('Product', productId);
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

    const result = await this.shopify.graphql(query, { id: gid });
    if (!result.product) return null;

    const variants = result.product.variants.edges.map(e => ShopifyService._gqlVariantToRest(e.node));
    let pageInfo = result.product.variants.pageInfo;

    while (pageInfo.hasNextPage) {
      const next = await this.shopify.graphql(query, { id: gid, after: pageInfo.endCursor });
      variants.push(...next.product.variants.edges.map(e => ShopifyService._gqlVariantToRest(e.node)));
      pageInfo = next.product.variants.pageInfo;
    }

    const images = result.product.media.edges
      .filter(e => e.node?.image?.url)
      .map(e => ({ url: e.node.image.url, src: e.node.image.url }));

    return { id: ShopifyService.fromGid(result.product.id), variants, images };
  }

  static _gqlVariantToRest(node) {
    const opts = node.selectedOptions || [];
    return {
      id: ShopifyService.fromGid(node.id),
      sku: node.sku || '',
      option1: opts[0]?.value || null,
      option2: opts[1]?.value || null,
      option3: opts[2]?.value || null
    };
  }

  /**
   * Upsert a product: create if not exists, merge variants if exists.
   * Create uses productSet (single call). Update uses productUpdate + variant bulk ops.
   * Returns { result, action: 'created' | 'updated', variantStats }
   */
  async upsertProduct(productData) {
    let existing = null;
    if (productData.handle) {
      existing = await this.getProductByHandle(productData.handle);
    }

    if (!existing) {
      const result = await this.createProduct(productData);
      const variantCount = productData.variants?.length || 1;
      return { result, action: 'created', variantStats: { added: variantCount, updated: 0 } };
    }

    // Product exists → update via GraphQL
    const numericId = ShopifyService.fromGid(existing.id);
    const gid = ShopifyService.toGid('Product', numericId);
    const existingProduct = await this._getProductGraphQL(numericId);

    // Update product-level fields via productUpdate
    const updateInput = { id: gid };
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

    // Collect new images for media param
    const images = productData.images || [];
    const newMedia = [];
    if (images.length > 0) {
      const existingFns = new Set(
        existingProduct.images.map(img => img.url.split('/').pop().split('?')[0].toLowerCase())
      );
      for (const img of images) {
        const fn = img.src.split('/').pop().split('?')[0].toLowerCase();
        if (!existingFns.has(fn)) {
          newMedia.push({ originalSource: img.src, alt: img.alt || undefined, mediaContentType: 'IMAGE' });
        }
      }
    }
    // Also add variant images that don't exist yet
    const csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
    const existingFns = new Set(
      existingProduct.images.map(img => img.url.split('/').pop().split('?')[0].toLowerCase())
    );
    for (const v of csvVariants) {
      if (v.variantImage) {
        const fn = v.variantImage.split('/').pop().split('?')[0].toLowerCase();
        if (!existingFns.has(fn) && !newMedia.find(m => m.originalSource === v.variantImage)) {
          newMedia.push({ originalSource: v.variantImage, mediaContentType: 'IMAGE' });
        }
      }
    }

    const updateMutation = `mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
      productUpdate(product: $product, media: $media) {
        product { id }
        userErrors { field message }
      }
    }`;
    const updateVars = { product: updateInput };
    if (newMedia.length > 0) updateVars.media = newMedia;
    await this.shopify.graphql(updateMutation, updateVars);

    // Merge variants: match by option key, bulk update existing, bulk create new
    const existingVariants = existingProduct.variants || [];
    let updatedCount = 0;
    const variantUpdates = [];
    const newVariantsToCreate = [];

    for (const csvVariant of csvVariants) {
      const optionKey = ShopifyService.buildOptionKey(
        csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value
      );
      const match = existingVariants.find(ev =>
        ShopifyService.buildOptionKey(ev.option1, ev.option2, ev.option3) === optionKey
      );

      if (match) {
        const upd = { id: ShopifyService.toGid('ProductVariant', match.id) };
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
        newVariantsToCreate.push(ShopifyService.buildVariant(csvVariant));
      }
    }

    // Bulk update existing variants
    if (variantUpdates.length > 0) {
      const bulkUpdateMut = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field message }
        }
      }`;
      for (let i = 0; i < variantUpdates.length; i += 250) {
        const batch = variantUpdates.slice(i, i + 250);
        await this.shopify.graphql(bulkUpdateMut, { productId: gid, variants: batch });
      }
    }

    // Bulk create new variants
    let addedCount = 0;
    if (newVariantsToCreate.length > 0) {
      const optionNames = [productData.option1Name, productData.option2Name, productData.option3Name].filter(Boolean);
      const created = await this._bulkCreateVariantsGraphQL(numericId, newVariantsToCreate, optionNames);
      addedCount = created.length;
    }

    // Re-fetch to get all variants, then link variant images
    const updatedProduct = await this._getProductGraphQL(numericId);
    await this._linkVariantImages(numericId, productData, updatedProduct.variants);

    return {
      result: { id: numericId },
      action: 'updated',
      variantStats: { added: addedCount, updated: updatedCount }
    };
  }

  /**
   * Update an existing product in Shopify via GraphQL.
   * Uses productUpdate for product fields + productVariantsBulkUpdate for variant.
   */
  async updateProduct(productId, productData) {
    try {
      const gid = ShopifyService.toGid('Product', productId);
      const updateInput = { id: gid };

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

      // Check if variant needs updating
      const needsVariantUpdate =
        productData.price || productData.compareAtPrice || productData.sku ||
        productData.barcode || productData.taxable !== undefined || productData.cost;

      // Check if image needs adding
      let newMedia = null;
      if (productData.imageUrl) {
        const existing = await this._getProductGraphQL(productId);
        const existingFns = new Set(
          (existing?.images || []).map(img => img.url.split('/').pop().split('?')[0].toLowerCase())
        );
        const fn = productData.imageUrl.split('/').pop().split('?')[0].toLowerCase();
        if (!existingFns.has(fn)) {
          newMedia = [{ originalSource: productData.imageUrl, alt: productData.imageAlt || undefined, mediaContentType: 'IMAGE' }];
        }

        // Update first variant if needed
        if (needsVariantUpdate && existing?.variants?.length > 0) {
          const variantGid = ShopifyService.toGid('ProductVariant', existing.variants[0].id);
          const vUpd = { id: variantGid };
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
          await this.shopify.graphql(varMut, { productId: gid, variants: [vUpd] });
        }
      } else if (needsVariantUpdate) {
        const existing = await this._getProductGraphQL(productId);
        if (existing?.variants?.length > 0) {
          const variantGid = ShopifyService.toGid('ProductVariant', existing.variants[0].id);
          const vUpd = { id: variantGid };
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
          await this.shopify.graphql(varMut, { productId: gid, variants: [vUpd] });
        }
      }

      // Update product fields (+ new media if any)
      const updateMut = `mutation productUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) {
          product { id }
          userErrors { field message }
        }
      }`;
      const vars = { product: updateInput };
      if (newMedia) vars.media = newMedia;
      const result = await this.shopify.graphql(updateMut, vars);

      if (result.productUpdate.userErrors?.length > 0) {
        throw new Error(result.productUpdate.userErrors[0].message);
      }

      return { id: ShopifyService.fromGid(result.productUpdate.product.id) };
    } catch (error) {
      console.error('Error updating product:', error);
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  /**
   * Get product by SKU using GraphQL (1 API call instead of paginating all products)
   */
  async getProductBySku(sku) {
    try {
      const query = `
        query GetProductBySku($query: String!) {
          productVariants(first: 1, query: $query) {
            edges {
              node {
                id
                sku
                product {
                  id
                  title
                  handle
                }
              }
            }
          }
        }
      `;

      const result = await this.shopify.graphql(query, { query: `sku:${sku}` });

      if (result.productVariants.edges.length > 0) {
        const node = result.productVariants.edges[0].node;
        return { product: node.product, variant: node };
      }

      return null;
    } catch (error) {
      console.error('Error getting product by SKU:', error);
      throw new Error(`Failed to get product by SKU: ${error.message}`);
    }
  }

  /**
   * Get product by handle using GraphQL
   * Used to detect duplicate handles before import
   */
  async getProductByHandle(handle) {
    try {
      const query = `
        query GetProductByHandle($query: String!) {
          products(first: 1, query: $query) {
            edges {
              node {
                id
                title
                handle
              }
            }
          }
        }
      `;

      const result = await this.shopify.graphql(query, { query: `handle:${handle}` });

      if (result.products.edges.length > 0) {
        return result.products.edges[0].node;
      }

      return null;
    } catch (error) {
      console.error('Error getting product by handle:', error);
      throw new Error(`Failed to get product by handle: ${error.message}`);
    }
  }

  /**
   * Batch fetch variant product info for order line items enrichment.
   * Returns Map<variantId (string), { productUrl, variantImageUrl }>
   * Uses nodes query in chunks of 250. Falls back to product.featuredImage if variant has no image.
   * Returns empty strings for deleted products (product_id=null) or API errors.
   *
   * @param {string[]} variantIds - Array of numeric variant IDs (as strings)
   * @param {string} shopDomain - Store myshopify domain (e.g. store.myshopify.com)
   */
  async getLineItemsProductInfo(variantIds, shopDomain) {
    const result = new Map();
    if (!variantIds || variantIds.length === 0) return result;

    const query = `
      query GetVariantInfo($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            image { url }
            product {
              handle
              featuredImage { url }
            }
          }
        }
      }
    `;

    const CHUNK_SIZE = 250;
    for (let i = 0; i < variantIds.length; i += CHUNK_SIZE) {
      const chunk = variantIds.slice(i, i + CHUNK_SIZE);
      const gids = chunk.map(id => ShopifyService.toGid('ProductVariant', id));

      try {
        const gqlResult = await this.shopify.graphql(query, { ids: gids });
        const nodes = gqlResult?.nodes || [];

        for (const node of nodes) {
          if (!node || !node.id) continue;
          const numericId = ShopifyService.fromGid(node.id).toString();
          const handle = node.product?.handle;
          const domain = shopDomain?.includes('.') ? shopDomain : `${shopDomain}.myshopify.com`;
          const productUrl = handle && domain
            ? `https://${domain}/products/${handle}`
            : '';
          const variantImageUrl = node.image?.url || node.product?.featuredImage?.url || '';
          result.set(numericId, { productUrl, variantImageUrl });
        }
      } catch (err) {
        console.error(`[ShopifyService] getLineItemsProductInfo chunk ${i / CHUNK_SIZE + 1} failed: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Get orders from Shopify
   * @param {Object} params - Query parameters (status, limit, since_id, etc.)
   */
  async getOrders(params = {}) {
    try {
      let queryParams;
      if (params.page_info) {
        // Cursor pagination: Shopify only allows page_info + limit, no other filters
        queryParams = { page_info: params.page_info };
        if (params.limit) queryParams.limit = params.limit;
      } else {
        queryParams = { limit: 250, status: 'any', ...params };
      }

      const orders = await this.shopify.order.list(queryParams);
      return orders;
    } catch (error) {
      console.error('Error getting orders:', error);
      throw new Error(`Failed to get orders: ${error.message}`);
    }
  }


  /**
   * Get order by ID
   */
  async getOrder(orderId) {
    try {
      const order = await this.shopify.order.get(orderId);
      return order;
    } catch (error) {
      console.error('Error getting order:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  /**
   * Get order by order number (e.g., #1001, 1001)
   */
  async getOrderByNumber(orderNumber) {
    try {
      // Remove # prefix if present
      const cleanNumber = orderNumber.toString().replace(/^#/, '');

      // Search by name (order number)
      const orders = await this.shopify.order.list({
        name: cleanNumber,
        limit: 1
      });

      if (orders.length > 0) {
        return orders[0];
      }

      // Try with # prefix
      const ordersWithHash = await this.shopify.order.list({
        name: `#${cleanNumber}`,
        limit: 1
      });

      return ordersWithHash.length > 0 ? ordersWithHash[0] : null;
    } catch (error) {
      console.error('Error getting order by number:', error);
      throw new Error(`Failed to get order by number: ${error.message}`);
    }
  }

  /**
   * Add tracking information to order
   * Creates a new fulfillment or updates existing one
   */
  async addOrderTracking(orderId, trackingInfo) {
    try {
      const order = await this.getOrder(orderId);

      // Check if order has existing fulfillments
      if (order.fulfillments && order.fulfillments.length > 0) {
        // Update first fulfillment
        const fulfillmentId = order.fulfillments[0].id;
        return await this.updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo);
      } else {
        // Create new fulfillment
        return await this.createFulfillment(orderId, trackingInfo);
      }
    } catch (error) {
      console.error('Error adding order tracking:', error);
      throw new Error(`Failed to add order tracking: ${error.message}`);
    }
  }

  /**
   * Update fulfillment tracking via GraphQL fulfillmentTrackingInfoUpdate
   */
  async updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo) {
    try {
      const mutation = `mutation fulfillmentTrackingInfoUpdate(
        $fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!, $notifyCustomer: Boolean
      ) {
        fulfillmentTrackingInfoUpdate(
          fulfillmentId: $fulfillmentId, trackingInfoInput: $trackingInfoInput, notifyCustomer: $notifyCustomer
        ) {
          fulfillment { id status }
          userErrors { field message }
        }
      }`;

      const result = await this.shopify.graphql(mutation, {
        fulfillmentId: ShopifyService.toGid('Fulfillment', fulfillmentId),
        trackingInfoInput: {
          number: trackingInfo.trackingNumber,
          company: trackingInfo.trackingCompany,
          url: trackingInfo.trackingUrl
        },
        notifyCustomer: true
      });

      if (result.fulfillmentTrackingInfoUpdate.userErrors?.length > 0) {
        throw new Error(result.fulfillmentTrackingInfoUpdate.userErrors[0].message);
      }

      return result.fulfillmentTrackingInfoUpdate.fulfillment;
    } catch (error) {
      console.error('Error updating fulfillment tracking:', error);
      throw new Error(`Failed to update tracking: ${error.message}`);
    }
  }

  /**
   * Create a new fulfillment with tracking via GraphQL fulfillmentCreate.
   * Queries fulfillment orders first, then creates fulfillment with tracking.
   */
  async createFulfillment(orderId, trackingInfo) {
    try {
      const orderGid = ShopifyService.toGid('Order', orderId);

      // Get fulfillment orders via GraphQL
      const foQuery = `query orderFulfillmentOrders($id: ID!) {
        order(id: $id) {
          fulfillmentOrders(first: 10) {
            edges {
              node {
                id
                status
                lineItems(first: 100) {
                  edges { node { id remainingQuantity } }
                }
              }
            }
          }
        }
      }`;

      const foResult = await this.shopify.graphql(foQuery, { id: orderGid });
      const fulfillmentOrders = foResult.order.fulfillmentOrders.edges.map(e => e.node);
      const openOrders = fulfillmentOrders.filter(
        fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS'
      );

      if (openOrders.length === 0) {
        throw new Error('No open fulfillment orders found');
      }

      const lineItemsByFulfillmentOrder = openOrders.map(fo => ({
        fulfillmentOrderId: fo.id,
        fulfillmentOrderLineItems: fo.lineItems.edges
          .filter(e => e.node.remainingQuantity > 0)
          .map(e => ({ id: e.node.id, quantity: e.node.remainingQuantity }))
      }));

      const mutation = `mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment { id status }
          userErrors { field message }
        }
      }`;

      const result = await this.shopify.graphql(mutation, {
        fulfillment: {
          lineItemsByFulfillmentOrder,
          trackingInfo: {
            number: trackingInfo.trackingNumber,
            company: trackingInfo.trackingCompany,
            url: trackingInfo.trackingUrl
          },
          notifyCustomer: true
        }
      });

      if (result.fulfillmentCreate.userErrors?.length > 0) {
        throw new Error(result.fulfillmentCreate.userErrors[0].message);
      }

      return result.fulfillmentCreate.fulfillment;
    } catch (error) {
      console.error('Error creating fulfillment:', error);
      throw new Error(`Failed to create fulfillment: ${error.message}`);
    }
  }

  /**
   * Get shop info via REST (simple read, no benefit from GraphQL)
   */
  async getShopInfo() {
    try {
      return await this.shopify.shop.get();
    } catch (error) {
      console.error('Error getting shop info:', error);
      throw new Error(`Failed to get shop info: ${error.message}`);
    }
  }

  /**
   * Verify shop credentials - throws on failure so callers can catch
   */
  async verifyCredentials() {
    await this.getShopInfo();
    return true;
  }


  /**
   * List all themes for the store
   */
  async getThemes() {
    try {
      const themes = await this.shopify.theme.list();
      return themes;
    } catch (error) {
      console.error('Error listing themes:', error);
      throw new Error(`Failed to list themes: ${error.message}`);
    }
  }

  /**
   * Create a theme from a URL (ZIP file)
   * @param {string} name - Theme name
   * @param {string} src - Public URL to theme ZIP file
   * @param {string} role - Theme role: 'unpublished' (default) or 'main'
   */
  async createTheme(name, src, role = 'unpublished') {
    try {
      const theme = await this.shopify.theme.create({ name, src, role });
      return theme;
    } catch (error) {
      console.error('Error creating theme:', error);
      throw new Error(`Failed to create theme: ${error.message}`);
    }
  }

  /**
   * Delete a theme by ID
   */
  async deleteTheme(themeId) {
    try {
      await this.shopify.theme.delete(themeId);
      return true;
    } catch (error) {
      console.error('Error deleting theme:', error);
      throw new Error(`Failed to delete theme: ${error.message}`);
    }
  }

  /**
   * Publish a theme (set role to main)
   */
  async publishTheme(themeId) {
    try {
      const theme = await this.shopify.theme.update(themeId, { role: 'main' });
      return theme;
    } catch (error) {
      console.error('Error publishing theme:', error);
      throw new Error(`Failed to publish theme: ${error.message}`);
    }
  }

  /**
   * Get metafield definitions for a given owner type using GraphQL
   */
  async getMetafieldDefinitions(ownerType = 'PRODUCT') {
    try {
      const query = `
        query MetafieldDefinitions($ownerType: MetafieldOwnerType!) {
          metafieldDefinitions(ownerType: $ownerType, first: 100) {
            nodes {
              id
              namespace
              key
              name
              type { name }
              description
              ownerType
              pinnedPosition
            }
          }
        }
      `;
      const result = await this.shopify.graphql(query, { ownerType });
      return result.metafieldDefinitions.nodes;
    } catch (error) {
      console.error('Error getting metafield definitions:', error);
      throw new Error(`Failed to get metafield definitions: ${error.message}`);
    }
  }

  /**
   * Create a metafield definition using GraphQL
   */
  async createMetafieldDefinition(definition) {
    try {
      const mutation = `
        mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition {
              id
              name
              namespace
              key
              type { name }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      const result = await this.shopify.graphql(mutation, { definition });
      const { createdDefinition, userErrors } = result.metafieldDefinitionCreate;
      if (userErrors && userErrors.length > 0) {
        throw new Error(userErrors.map(e => e.message).join(', '));
      }
      return createdDefinition;
    } catch (error) {
      console.error('Error creating metafield definition:', error);
      throw new Error(`Failed to create metafield definition: ${error.message}`);
    }
  }

  /**
   * Get all shop policies via REST API (more reliable than GraphQL shopPolicies query).
   * Returns normalized array with type field matching GraphQL enum values for shopPolicyUpdate.
   */
  async getShopPolicies() {
    try {
      const policies = await this.shopify.policy.list();
      // Map REST handle → GraphQL ShopPolicyType enum used by shopPolicyUpdate mutation
      const HANDLE_TO_TYPE = {
        'refund-policy': 'REFUND_POLICY',
        'privacy-policy': 'PRIVACY_POLICY',
        'terms-of-service': 'TERMS_OF_SERVICE',
        'shipping-policy': 'SHIPPING_POLICY',
        'subscription-policy': 'SUBSCRIPTION_POLICY'
      };
      return policies.map(p => ({
        id: p.id,
        type: HANDLE_TO_TYPE[p.handle] || p.handle.toUpperCase().replace(/-/g, '_'),
        title: p.title,
        body: p.body || '',
        url: p.url
      }));
    } catch (error) {
      console.error('Error getting shop policies:', error);
      throw new Error(`Failed to get shop policies: ${error.message}`);
    }
  }

  /**
   * Update a single shop policy via GraphQL shopPolicyUpdate mutation
   * @param {string} type - Policy type: REFUND_POLICY | PRIVACY_POLICY | TERMS_OF_SERVICE | SHIPPING_POLICY | SUBSCRIPTION_POLICY
   * @param {string} body - HTML content of the policy
   */
  async updateShopPolicy(type, body) {
    try {
      const mutation = `
        mutation shopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
          shopPolicyUpdate(shopPolicy: $shopPolicy) {
            shopPolicy {
              id
              type
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      const result = await this.shopify.graphql(mutation, { shopPolicy: { type, body } });
      const { shopPolicy, userErrors } = result.shopPolicyUpdate;
      if (userErrors && userErrors.length > 0) {
        throw new Error(userErrors.map(e => e.message).join(', '));
      }
      return shopPolicy;
    } catch (error) {
      console.error(`Error updating shop policy ${type}:`, error);
      throw new Error(`Failed to update ${type}: ${error.message}`);
    }
  }

  /**
   * Normalize shop domain input
   * Handles common user input mistakes
   */
  static normalizeShopDomain(input) {
    if (!input) return null;

    let domain = input.trim().toLowerCase();

    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');

    // Remove trailing slash
    domain = domain.replace(/\/$/, '');

    // Remove .myshopify.com if present
    domain = domain.replace(/\.myshopify\.com.*$/, '');

    // Remove /admin or other paths
    domain = domain.split('/')[0];

    // Remove any remaining dots or special characters
    domain = domain.replace(/[^a-z0-9-]/g, '');

    return domain;
  }

  /**
   * Get fulfilled orders with tracking info via GraphQL.
   * Returns orders that have fulfillments with tracking numbers.
   * Paginates automatically up to maxPages (default 5 = ~125 orders).
   */
  async getOrdersWithFulfillments({first = 25, maxPages = 5, query = 'fulfillment_status:shipped'} = {}) {
    const gqlQuery = `query GetFulfilledOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
            fulfillments {
              trackingInfo {
                number
                company
                url
              }
              status
              createdAt
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const allOrders = [];
    let after = null;

    for (let page = 0; page < maxPages; page++) {
      const result = await this.shopify.graphql(gqlQuery, {first, after, query});
      const edges = result.orders.edges || [];
      const orders = edges
        .map(e => e.node)
        .filter(o => o.fulfillments?.some(f => f.trackingInfo?.some(t => t.number)));

      allOrders.push(...orders);

      if (!result.orders.pageInfo.hasNextPage) break;
      after = result.orders.pageInfo.endCursor;
    }

    return allOrders;
  }
}
