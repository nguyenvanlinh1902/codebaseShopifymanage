/**
 * Shopify Product Extras Controller — shop metadata, publish, inventory, metafields, image upload.
 * Imports shared helpers from shopify-product-controller to avoid duplication.
 */

import {getShopify, validateStoreAccess, handleError} from './shopify-product-controller.js';
import {
  createStagedUpload, getStorePublications, publishProduct,
  getLocations, duplicateProduct as duplicateProductInShopify
} from '../services/shopify-product-channel-service.js';
import {
  listMetafieldDefinitions as listMetafieldDefs,
  createMetafieldDefinition as createMetafieldDef,
  deleteMetafield as deleteMetafieldById
} from '../services/shopify-product-metafield-service.js';
import {setInventoryQuantity} from '../services/shopify-product-inventory-service.js';
import {toGid} from '../services/shopify-helpers.js';

/** POST /api/shopify-products/:id/variants — create a new variant */
export async function addVariant(req, res) {
  try {
    const {id} = req.params;
    const {storeId, variant} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);

    const input = {
      optionValues: variant.optionValues,
      price: variant.price,
      barcode: variant.barcode || undefined,
      inventoryPolicy: variant.inventoryPolicy || 'DENY',
      inventoryItem: {
        sku: variant.sku || '',
        tracked: variant.inventoryItem?.tracked !== false,
        requiresShipping: variant.requiresShipping !== false
      },
      taxable: variant.taxable !== false
    };
    if (Array.isArray(variant.inventoryQuantities) && variant.inventoryQuantities.length > 0) {
      input.inventoryQuantities = variant.inventoryQuantities.filter(q => q.locationId);
    }
    if (variant.imageSrc) input.mediaSrc = [variant.imageSrc];

    const result = await shopify.graphql(
      `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
        productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
          productVariants { id }
          userErrors { field message code }
        }
      }`,
      {
        productId: toGid('Product', id),
        variants: [input],
        strategy: 'REMOVE_STANDALONE_VARIANT'
      }
    );
    const payload = result?.productVariantsBulkCreate;
    if (payload?.userErrors?.length > 0) {
      throw new Error(payload.userErrors.map(e => e.message).join('; '));
    }
    res.json({success: true, data: payload.productVariants?.[0] || null});
  } catch (error) {
    handleError(res, 'addVariant', error);
  }
}

/** POST /api/shopify-products/upload-image */
export async function uploadImage(req, res) {
  try {
    const {storeId, filename, mimeType, fileSize} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await createStagedUpload(shopify, {filename, mimeType, fileSize});
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'uploadImage', error);
  }
}

/** GET /api/shopify-products/product-types */
export async function productTypes(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const result = await shopify.graphql(
      `query { shop { productTypes(first: 50) { edges { node } } } }`
    );
    const types = (result?.shop?.productTypes?.edges || []).map(e => e.node);
    res.json({success: true, data: types});
  } catch (error) {
    handleError(res, 'productTypes', error);
  }
}

/** GET /api/shopify-products/vendors */
export async function vendors(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const result = await shopify.graphql(
      `query { shop { productVendors(first: 50) { edges { node } } } }`
    );
    const vendorList = (result?.shop?.productVendors?.edges || []).map(e => e.node);
    res.json({success: true, data: vendorList});
  } catch (error) {
    handleError(res, 'vendors', error);
  }
}

/** GET /api/shopify-products/sales-channels */
export async function salesChannels(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await getStorePublications(shopify);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'salesChannels', error);
  }
}

/** GET /api/shopify-products/locations */
export async function locations(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await getLocations(shopify);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'locations', error);
  }
}

/** POST /api/shopify-products/:id/duplicate */
export async function duplicateProduct(req, res) {
  try {
    const {storeId, newTitle} = req.body;
    const {id} = req.params;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await duplicateProductInShopify(shopify, id, newTitle);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'duplicateProduct', error);
  }
}

/** POST /api/shopify-products/:id/inventory */
export async function setInventory(req, res) {
  try {
    const {storeId, inventoryItemId, locationId, quantity} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await setInventoryQuantity(shopify, inventoryItemId, locationId, quantity);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'setInventory', error);
  }
}

/** GET /api/shopify-products/metafield-definitions */
export async function listMetafieldDefinitions(req, res) {
  try {
    const {storeId, ownerType} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await listMetafieldDefs(shopify, ownerType || 'PRODUCT');
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'listMetafieldDefinitions', error);
  }
}

/** POST /api/shopify-products/metafield-definitions */
export async function createMetafieldDefinition(req, res) {
  try {
    const {storeId, ...input} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await createMetafieldDef(shopify, input);
    res.status(201).json({success: true, data});
  } catch (error) {
    handleError(res, 'createMetafieldDefinition', error);
  }
}

/** DELETE /api/shopify-products/metafields/:metafieldId */
export async function deleteMetafield(req, res) {
  try {
    const {storeId} = req.query;
    const {metafieldId} = req.params;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await deleteMetafieldById(shopify, metafieldId);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'deleteMetafield', error);
  }
}

/** POST /api/shopify-products/:id/publish */
export async function publishProductChannels(req, res) {
  try {
    const {storeId, publishIds, unpublishIds} = req.body;
    const {id} = req.params;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await publishProduct(shopify, id, publishIds || [], unpublishIds || []);
    res.json({success: true, data});
  } catch (error) {
    handleError(res, 'publishProduct', error);
  }
}
