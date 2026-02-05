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
        variants: [
          {
            price: productData.price || '0.00',
            compare_at_price: productData.compareAtPrice || null,
            sku: productData.sku || '',
            barcode: productData.barcode || '',
            inventory_quantity: parseInt(productData.inventoryQuantity || 0),
            inventory_management: 'shopify'
          }
        ]
      };

      // Add image if provided
      if (productData.imageUrl) {
        shopifyProduct.images = [
          {
            src: productData.imageUrl
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

      // Update variant if needed
      if (productData.price || productData.sku || productData.inventoryQuantity) {
        const product = await this.shopify.product.get(productId);
        if (product.variants && product.variants.length > 0) {
          const variantId = product.variants[0].id;
          const variantUpdate = {id: variantId};

          if (productData.price) variantUpdate.price = productData.price;
          if (productData.compareAtPrice) variantUpdate.compare_at_price = productData.compareAtPrice;
          if (productData.sku) variantUpdate.sku = productData.sku;
          if (productData.barcode) variantUpdate.barcode = productData.barcode;
          if (productData.inventoryQuantity) {
            variantUpdate.inventory_quantity = parseInt(productData.inventoryQuantity);
          }

          await this.shopify.productVariant.update(variantId, variantUpdate);
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
      const defaultParams = {
        limit: 250,
        status: 'any',
        ...params
      };

      const orders = await this.shopify.order.list(defaultParams);
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
   */
  async createFulfillment(orderId, trackingInfo) {
    try {
      const order = await this.getOrder(orderId);

      // Get all unfulfilled line items
      const lineItems = order.line_items
        .filter(item => item.fulfillment_status !== 'fulfilled')
        .map(item => ({id: item.id, quantity: item.quantity}));

      if (lineItems.length === 0) {
        throw new Error('No unfulfilled items in order');
      }

      const fulfillment = await this.shopify.fulfillment.create(orderId, {
        location_id: order.line_items[0].fulfillment_service,
        tracking_number: trackingInfo.trackingNumber,
        tracking_company: trackingInfo.trackingCompany,
        tracking_url: trackingInfo.trackingUrl,
        line_items: lineItems,
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
