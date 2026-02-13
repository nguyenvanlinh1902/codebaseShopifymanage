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
        autoLimit: {calls: 2, interval: 1000, bucketSize: 35},
        timeout: 180000 // 3 min - products with many variants/images need more time
      });
      this.shopDomain = shopConfig.shopDomain;
    }
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
   * Create a product in Shopify.
   * Supports grouped products with multiple variants (Shopify CSV format).
   */
  async createProduct(productData) {
    try {
      // Build variants array - supports both grouped (variants[]) and legacy (single variant) format
      let allVariants;
      if (productData.variants && productData.variants.length > 0) {
        allVariants = productData.variants.map(v => ShopifyService.buildVariant(v));
      } else {
        allVariants = [ShopifyService.buildVariant(productData)];
      }

      // Shopify REST API limits product.create to ~100 variants.
      // Create product with first batch, then add remaining variants individually.
      const VARIANT_BATCH_LIMIT = 100;
      const initialVariants = allVariants.slice(0, VARIANT_BATCH_LIMIT);
      const remainingVariants = allVariants.slice(VARIANT_BATCH_LIMIT);

      const shopifyProduct = {
        title: productData.title,
        body_html: productData.description || '',
        vendor: productData.vendor || '',
        product_type: productData.productType || '',
        tags: productData.tags || '',
        status: productData.status || 'draft',
        handle: productData.handle || undefined,
        variants: initialVariants
      };

      // Add product options
      const options = [];
      if (productData.option1Name) options.push({name: productData.option1Name});
      if (productData.option2Name) options.push({name: productData.option2Name});
      if (productData.option3Name) options.push({name: productData.option3Name});
      if (options.length > 0) shopifyProduct.options = options;

      // Gift card
      if (productData.giftCard) shopifyProduct.gift_card = true;

      // Add SEO fields if provided
      if (productData.seoTitle || productData.seoDescription) {
        shopifyProduct.metafields_global_title_tag = productData.seoTitle || undefined;
        shopifyProduct.metafields_global_description_tag = productData.seoDescription || undefined;
      }

      // Add metafields from product data (e.g., seo.hidden from CSV)
      const metafields = ShopifyService.buildMetafieldsFromProduct(productData);
      if (metafields.length > 0) {
        shopifyProduct.metafields = metafields;
      }

      // Collect images but DON'T send in product.create (avoids timeout for many images).
      // Images are uploaded individually after product creation.
      let imagesToUpload = [];
      if (productData.images && productData.images.length > 0) {
        imagesToUpload = productData.images;
      } else if (productData.imageUrl) {
        imagesToUpload = [
          {
            src: productData.imageUrl,
            alt: productData.imageAlt || undefined,
            position: productData.imagePosition ? parseInt(productData.imagePosition) : undefined
          }
        ];
      }

      const result = await this.shopify.product.create(shopifyProduct);
      const productId = result.id;

      // Track all created variants (initial batch from result)
      const allCreatedVariants = [...(result.variants || [])];

      // Add remaining variants individually (product.create limited to 100 per call,
      // but Shopify supports up to 2000 variants per product)
      if (remainingVariants.length > 0) {
        console.log(`Product ${productId}: adding ${remainingVariants.length} remaining variants individually`);
        let variantFailCount = 0;
        for (const variant of remainingVariants) {
          try {
            const created = await this.shopify.productVariant.create(productId, variant);
            allCreatedVariants.push(created);
          } catch (err) {
            variantFailCount++;
            const detail = err.response?.body?.errors || err.message;
            if (variantFailCount <= 5) {
              console.warn(`Failed to add variant (${variant.option1}/${variant.option2}/${variant.option3}): ${JSON.stringify(detail)}`);
            }
          }
        }
        if (variantFailCount > 0) {
          console.warn(`Product ${productId}: ${variantFailCount}/${remainingVariants.length} variants failed to create`);
        }
      }

      // Upload images one by one, tracking originalSrc → imageId for variant linking.
      // Shopify CDN renames files, so filename matching is unreliable.
      const allCreatedImages = [];
      const srcToImageId = {};
      if (imagesToUpload.length > 0) {
        console.log(`Uploading ${imagesToUpload.length} images for product ${productId}`);
        for (const img of imagesToUpload) {
          try {
            const created = await this.shopify.productImage.create(productId, img);
            allCreatedImages.push(created);
            srcToImageId[img.src] = created.id;
          } catch (err) {
            console.warn(`Failed to upload image ${img.src}: ${err.message}`);
          }
        }
      }

      // Link variant images using the upload map (originalSrc → imageId)
      await this._linkVariantImages(productData, allCreatedVariants, allCreatedImages, srcToImageId);

      return result;
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
   * Link variant images to created variants.
   * Uses srcToImageId map (original URL → Shopify image ID) from upload tracking.
   * Matches variants by: (1) SKU, (2) option key, (3) position index.
   */
  async _linkVariantImages(productData, createdVariants, allImages, srcToImageId = {}) {
    const csvVariants = productData.variants && productData.variants.length > 0
      ? productData.variants
      : [productData];

    const variantsWithImages = csvVariants.filter(v => v.variantImage);
    if (variantsWithImages.length === 0) return;
    if (Object.keys(srcToImageId).length === 0 && allImages.length === 0) {
      console.log(`_linkVariantImages: skip - ${variantsWithImages.length} need images but 0 available`);
      return;
    }

    // Filename → image ID fallback (for existing Shopify images)
    const fileNameToImageId = {};
    for (const img of allImages) {
      const fn = img.src.split('/').pop().split('?')[0].toLowerCase();
      fileNameToImageId[fn] = img.id;
    }

    // Build SKU → Shopify variant map (most reliable matching)
    const skuToVariant = {};
    const optionKeyToVariant = {};
    for (const v of createdVariants) {
      if (v.sku) skuToVariant[v.sku] = v;
      const key = ShopifyService.buildOptionKey(v.option1, v.option2, v.option3);
      optionKeyToVariant[key] = v;
    }

    console.log(`_linkVariantImages: ${Object.keys(srcToImageId).length} mapped, ${allImages.length} imgs, ${createdVariants.length} variants on Shopify`);

    let linkedCount = 0;
    let noImage = 0;
    let noVariant = 0;
    for (const csvVariant of variantsWithImages) {
      // Find image: srcToImageId (direct URL) → filename fallback
      let imageId = srcToImageId[csvVariant.variantImage];
      if (!imageId) {
        const fn = csvVariant.variantImage.split('/').pop().split('?')[0].toLowerCase();
        imageId = fileNameToImageId[fn];
      }
      if (!imageId) { noImage++; continue; }

      // Find variant: SKU match → option key match
      let match = csvVariant.sku ? skuToVariant[csvVariant.sku] : null;
      if (!match) {
        const csvKey = ShopifyService.buildOptionKey(
          csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value
        );
        match = optionKeyToVariant[csvKey];
      }
      if (!match) { noVariant++; continue; }

      try {
        await this.shopify.productVariant.update(match.id, {image_id: imageId});
        linkedCount++;
      } catch (err) {
        console.warn(`_linkVariantImages: update failed variant ${match.id}: ${err.message}`);
      }
    }

    console.log(`_linkVariantImages: linked ${linkedCount}/${variantsWithImages.length} (${noImage} no-image, ${noVariant} no-variant)`);
  }

  /**
   * Upsert a product: create if not exists, merge variants if exists.
   * - Finds existing product by handle
   * - If not found: create new product with all variants
   * - If found: update product-level fields + merge variants (add new, update existing)
   * Returns { result, action: 'created' | 'updated', variantStats }
   */
  async upsertProduct(productData) {
    // Try to find existing product by handle
    let existing = null;
    if (productData.handle) {
      existing = await this.getProductByHandle(productData.handle);
    }

    if (!existing) {
      // Product doesn't exist → create new
      const result = await this.createProduct(productData);
      const variantCount = result.variants?.length || 0;
      return {result, action: 'created', variantStats: {added: variantCount, updated: 0}};
    }

    // Product exists → update product fields + merge variants
    const numericId = existing.id.replace(/^gid:\/\/shopify\/Product\//, '');
    const existingProduct = await this.shopify.product.get(numericId);

    // Update product-level fields
    const updateData = {id: numericId};
    if (productData.title) updateData.title = productData.title;
    if (productData.description !== undefined) updateData.body_html = productData.description;
    if (productData.vendor) updateData.vendor = productData.vendor;
    if (productData.productType) updateData.product_type = productData.productType;
    if (productData.tags) updateData.tags = productData.tags;
    if (productData.status) updateData.status = productData.status;
    if (productData.seoTitle) updateData.metafields_global_title_tag = productData.seoTitle;
    if (productData.seoDescription) {
      updateData.metafields_global_description_tag = productData.seoDescription;
    }

    await this.shopify.product.update(numericId, updateData);

    // Merge variants: match by option values (option1+option2+option3)
    const csvVariants = productData.variants && productData.variants.length > 0
      ? productData.variants
      : [productData];

    const existingVariants = existingProduct.variants || [];
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const csvVariant of csvVariants) {
      const optionKey = ShopifyService.buildOptionKey(
        csvVariant.option1Value, csvVariant.option2Value, csvVariant.option3Value
      );

      // Find matching existing variant by option values
      const match = existingVariants.find(ev =>
        ShopifyService.buildOptionKey(ev.option1, ev.option2, ev.option3) === optionKey
      );

      const variantData = ShopifyService.buildVariant(csvVariant);

      if (match) {
        // Update existing variant
        await this.shopify.productVariant.update(match.id, variantData);
        updatedCount++;
      } else {
        // Add new variant to product
        try {
          await this.shopify.productVariant.create(numericId, variantData);
          addedCount++;
        } catch (err) {
          skippedCount++;
          const detail = err.response?.body?.errors || err.message;
          if (skippedCount <= 5) {
            console.warn(`Failed to add variant ${optionKey}: ${JSON.stringify(detail)}`);
          }
        }
      }
    }
    if (skippedCount > 0) {
      console.warn(`Product ${numericId}: ${skippedCount} variants failed to create`);
    }

    // Add new images, track originalSrc → imageId for variant linking
    const images = productData.images || [];
    const srcToImageId = {};
    if (images.length > 0) {
      const existingImageSrcs = new Set(
        (existingProduct.images || []).map(img =>
          img.src.split('/').pop().split('?')[0].toLowerCase()
        )
      );
      for (const img of images) {
        const fileName = img.src.split('/').pop().split('?')[0].toLowerCase();
        if (!existingImageSrcs.has(fileName)) {
          try {
            const created = await this.shopify.productImage.create(numericId, img);
            srcToImageId[img.src] = created.id;
          } catch (err) {
            console.warn(`Failed to add image ${img.src}: ${err.message}`);
          }
        }
      }
    }

    // Re-fetch product to get all images + variants (including newly added ones)
    const updatedProduct = await this.shopify.product.get(numericId);
    const allVariantsNow = updatedProduct.variants || [];
    const allImagesNow = updatedProduct.images || [];

    // Link variant images (srcToImageId for new uploads + allImagesNow for filename fallback)
    await this._linkVariantImages(productData, allVariantsNow, allImagesNow, srcToImageId);

    return {
      result: {id: numericId},
      action: 'updated',
      variantStats: {added: addedCount, updated: updatedCount}
    };
  }

  /**
   * Update an existing product in Shopify
   */
  async updateProduct(productId, productData) {
    try {
      const updateData = {
        id: productId
      };

      if (productData.title) updateData.title = productData.title;
      if (productData.description !== undefined) updateData.body_html = productData.description;
      if (productData.vendor) updateData.vendor = productData.vendor;
      if (productData.productType) updateData.product_type = productData.productType;
      if (productData.tags) updateData.tags = productData.tags;
      if (productData.status) updateData.status = productData.status;
      if (productData.handle) updateData.handle = productData.handle;

      // Update SEO fields
      if (productData.seoTitle) {
        updateData.metafields_global_title_tag = productData.seoTitle;
      }
      if (productData.seoDescription) {
        updateData.metafields_global_description_tag = productData.seoDescription;
      }

      // Update variant if needed
      const needsVariantUpdate =
        productData.price ||
        productData.compareAtPrice ||
        productData.sku ||
        productData.barcode ||
        productData.inventoryQuantity ||
        productData.weight ||
        productData.weightUnit ||
        productData.requiresShipping !== undefined ||
        productData.taxable !== undefined ||
        productData.cost;

      if (needsVariantUpdate) {
        const product = await this.shopify.product.get(productId);
        if (product.variants && product.variants.length > 0) {
          const variantId = product.variants[0].id;
          const variantUpdate = {id: variantId};

          if (productData.price) variantUpdate.price = productData.price;
          if (productData.compareAtPrice)
            variantUpdate.compare_at_price = productData.compareAtPrice;
          if (productData.sku) variantUpdate.sku = productData.sku;
          if (productData.barcode) variantUpdate.barcode = productData.barcode;
          if (productData.inventoryQuantity !== undefined) {
            variantUpdate.inventory_quantity = parseInt(productData.inventoryQuantity);
          }
          if (productData.weight !== undefined) variantUpdate.weight = productData.weight;
          if (productData.weightUnit) variantUpdate.weight_unit = productData.weightUnit;
          if (productData.requiresShipping !== undefined) {
            variantUpdate.requires_shipping = productData.requiresShipping;
          }
          if (productData.taxable !== undefined) variantUpdate.taxable = productData.taxable;
          if (productData.cost) variantUpdate.cost = productData.cost;

          await this.shopify.productVariant.update(variantId, variantUpdate);
        }
      }

      // Update image if provided
      if (productData.imageUrl) {
        const product = await this.shopify.product.get(productId);
        // Check if image already exists
        const existingImage = product.images?.find(img => img.src === productData.imageUrl);
        if (!existingImage) {
          await this.shopify.productImage.create(productId, {
            src: productData.imageUrl,
            alt: productData.imageAlt || undefined
          });
        }
      }

      const result = await this.shopify.product.update(productId, updateData);
      return result;
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

      const result = await this.shopify.graphql(query, {query: `sku:${sku}`});

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

      const result = await this.shopify.graphql(query, {query: `handle:${handle}`});

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
   * Get orders from Shopify
   * @param {Object} params - Query parameters (status, limit, since_id, etc.)
   */
  async getOrders(params = {}) {
    try {
      let queryParams;
      if (params.page_info) {
        // Cursor pagination: Shopify only allows page_info + limit, no other filters
        queryParams = {page_info: params.page_info};
        if (params.limit) queryParams.limit = params.limit;
      } else {
        queryParams = {limit: 250, status: 'any', ...params};
      }

      const orders = await this.shopify.order.list(queryParams);
      return orders;
    } catch (error) {
      console.error('Error getting orders:', error);
      throw new Error(`Failed to get orders: ${error.message}`);
    }
  }

  /**
   * Get all orders from Shopify with pagination
   * Uses since_id to paginate through all orders
   * @param {Object} params - Query parameters (created_at_min, status, etc.)
   */
  async getAllOrders(params = {}) {
    try {
      const allOrders = [];
      let lastId = null;
      const limit = 250;

      while (true) {
        const queryParams = {limit, status: 'any', ...params};
        if (lastId) queryParams.since_id = lastId;

        const orders = await this.shopify.order.list(queryParams);
        if (orders.length === 0) break;

        allOrders.push(...orders);
        lastId = orders[orders.length - 1].id;

        if (orders.length < limit) break;
      }

      return allOrders;
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw new Error(`Failed to get all orders: ${error.message}`);
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
   * Update fulfillment with tracking info
   */
  async updateFulfillmentTracking(orderId, fulfillmentId, trackingInfo) {
    try {
      const result = await this.shopify.fulfillment.updateTracking(fulfillmentId, {
        tracking_info: {
          number: trackingInfo.trackingNumber,
          company: trackingInfo.trackingCompany,
          url: trackingInfo.trackingUrl
        },
        notify_customer: true
      });

      return result;
    } catch (error) {
      console.error('Error updating fulfillment tracking:', error);
      throw new Error(`Failed to update tracking: ${error.message}`);
    }
  }

  /**
   * Create a new fulfillment with tracking
   * Uses Fulfillment Orders API (legacy fulfillment endpoint returns 406)
   */
  async createFulfillment(orderId, trackingInfo) {
    try {
      // Get fulfillment orders for this order
      const fulfillmentOrders = await this.shopify.order.fulfillmentOrders(orderId);

      // Find open/unfulfilled fulfillment orders
      const openOrders = fulfillmentOrders.filter(
        fo => fo.status === 'open' || fo.status === 'in_progress'
      );

      if (openOrders.length === 0) {
        throw new Error('No open fulfillment orders found');
      }

      // Build line_items_by_fulfillment_order for createV2
      const lineItemsByFulfillmentOrder = openOrders.map(fo => ({
        fulfillment_order_id: fo.id,
        fulfillment_order_line_items: fo.line_items.map(li => ({
          id: li.id,
          quantity: li.fulfillable_quantity
        }))
      }));

      const fulfillment = await this.shopify.fulfillment.createV2({
        line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
        tracking_info: {
          number: trackingInfo.trackingNumber,
          company: trackingInfo.trackingCompany,
          url: trackingInfo.trackingUrl
        },
        notify_customer: true
      });

      return fulfillment;
    } catch (error) {
      console.error('Error creating fulfillment:', error);
      throw new Error(`Failed to create fulfillment: ${error.message}`);
    }
  }

  /**
   * Get shop info
   */
  async getShopInfo() {
    try {
      const shop = await this.shopify.shop.get();
      return shop;
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
   * Create webhook
   */
  async createWebhook(webhookData) {
    try {
      const webhook = await this.shopify.webhook.create(webhookData);
      return webhook;
    } catch (error) {
      console.error('Error creating webhook:', error);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  }

  /**
   * List webhooks
   */
  async listWebhooks() {
    try {
      const webhooks = await this.shopify.webhook.list();
      return webhooks;
    } catch (error) {
      console.error('Error listing webhooks:', error);
      throw new Error(`Failed to list webhooks: ${error.message}`);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    try {
      await this.shopify.webhook.delete(webhookId);
      return true;
    } catch (error) {
      console.error('Error deleting webhook:', error);
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
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
      const theme = await this.shopify.theme.create({name, src, role});
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
      const theme = await this.shopify.theme.update(themeId, {role: 'main'});
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
      const result = await this.shopify.graphql(query, {ownerType});
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
      const result = await this.shopify.graphql(mutation, {definition});
      const {createdDefinition, userErrors} = result.metafieldDefinitionCreate;
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
}
