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
        autoLimit: {calls: 2, interval: 1000, bucketSize: 35}
      });
      this.shopDomain = shopConfig.shopDomain;
    }
  }

  /**
   * Build metafields array from product data.
   * Maps CSV-parsed fields to Shopify metafield format.
   */
  static buildMetafieldsFromProduct(productData) {
    const metafields = [];

    // seo.hidden - Hide product from search engines
    if (productData.seoHidden !== undefined && productData.seoHidden !== null) {
      metafields.push({
        namespace: 'seo',
        key: 'hidden',
        value: productData.seoHidden ? '1' : '0',
        type: 'number_integer'
      });
    }

    // Future metafields can be added here following the same pattern:
    // if (productData.someField) {
    //   metafields.push({ namespace: 'x', key: 'y', value: '...', type: '...' });
    // }

    return metafields;
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
            requires_shipping:
              productData.requiresShipping !== undefined ? productData.requiresShipping : true,
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

      // Add metafields from product data (e.g., seo.hidden from CSV)
      const metafields = ShopifyService.buildMetafieldsFromProduct(productData);
      if (metafields.length > 0) {
        shopifyProduct.metafields = metafields;
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
