/**
 * Product Operations Module
 * Handles all product-related Shopify API operations
 */

/**
 * Build metafields array from product data.
 * Maps CSV-parsed fields to Shopify metafield format.
 */
export function buildMetafieldsFromProduct(productData) {
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
export async function createProduct(productData) {
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
    const metafields = buildMetafieldsFromProduct(productData);
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
export async function updateProduct(productId, productData) {
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
 * Get product by SKU using GraphQL (1 API call instead of paginating all products)
 */
export async function getProductBySku(sku) {
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
export async function getProductByHandle(handle) {
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
