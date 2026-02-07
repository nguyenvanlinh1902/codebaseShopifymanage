import Shopify from 'shopify-api-node';

/**
 * Shopify Service
 * Handles all interactions with Shopify API
 */
export class ShopifyService {
  constructor(shopConfig) {
    if (shopConfig) {
      this.shopify = new Shopify({
        shopName: shopConfig.shopDomain,
        accessToken: shopConfig.accessToken
      });
      this.shopDomain = shopConfig.shopDomain;
    }
  }

  /**
   * Create or update a product in Shopify
   */
  async createProduct(productData) {
    try {
      const shopifyProduct = {
        title: productData.title,
        body_html: productData.description || '',
        vendor: productData.vendor || '',
        product_type: productData.productType || '',
        tags: productData.tags || '',
        status: productData.status || 'draft',
        handle: productData.handle || undefined,
        variants: [
          {
            price: productData.price || '0.00',
            compare_at_price: productData.compareAtPrice || null,
            sku: productData.sku || '',
            barcode: productData.barcode || '',
            inventory_quantity: parseInt(productData.inventoryQuantity || 0),
            inventory_management: 'shopify',
            weight: productData.weight || 0,
            weight_unit: productData.weightUnit || 'lb',
            requires_shipping: productData.requiresShipping !== undefined ? productData.requiresShipping : true,
            taxable: productData.taxable !== undefined ? productData.taxable : true
          }
        ]
      };

      // Add cost if provided (requires Shopify Plus for inventory cost tracking)
      if (productData.cost) {
        shopifyProduct.variants[0].cost = productData.cost;
      }

      // Add SEO fields if provided
      if (productData.seoTitle || productData.seoDescription) {
        shopifyProduct.metafields_global_title_tag = productData.seoTitle || undefined;
        shopifyProduct.metafields_global_description_tag = productData.seoDescription || undefined;
      }

      // Add image if provided
      if (productData.imageUrl) {
        shopifyProduct.images = [
          {
            src: productData.imageUrl,
            alt: productData.imageAlt || undefined
          }
        ];
      }

      const result = await this.shopify.product.create(shopifyProduct);
      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }
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
          if (productData.compareAtPrice) variantUpdate.compare_at_price = productData.compareAtPrice;
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
   * Get product by SKU with pagination support
   */
  async getProductBySku(sku) {
    try {
      const params = {limit: 250};
      let hasMore = true;

      while (hasMore) {
        const products = await this.shopify.product.list(params);

        // Search in current batch
        for (const product of products) {
          for (const variant of product.variants) {
            if (variant.sku === sku) {
              return {product, variant};
            }
          }
        }

        // Check if there are more products
        if (products.length < 250) {
          hasMore = false;
        } else {
          // Set since_id for next page
          params.since_id = products[products.length - 1].id;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting product by SKU:', error);
      throw new Error(`Failed to get product by SKU: ${error.message}`);
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
   * Verify shop credentials
   */
  async verifyCredentials() {
    try {
      await this.getShopInfo();
      return true;
    } catch (error) {
      return false;
    }
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
