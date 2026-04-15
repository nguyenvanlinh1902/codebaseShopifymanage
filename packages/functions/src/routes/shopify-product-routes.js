/**
 * Shopify Product routes — Express Router for /api/shopify-products.
 */

import {Router} from 'express';
import * as controller from '../controllers/shopify-product-controller.js';
import * as extras from '../controllers/shopify-product-extras-controller.js';

const router = new Router();

// Existing routes
router.get('/list', controller.list);
router.get('/collections', controller.listCollections);
router.post('/bulk-action', controller.bulkAction);

// Specific static routes BEFORE wildcard /:id
router.get('/product-types', extras.productTypes);
router.get('/vendors', extras.vendors);
router.get('/sales-channels', extras.salesChannels);
router.get('/locations', extras.locations);
router.get('/metafield-definitions', extras.listMetafieldDefinitions);
router.post('/metafield-definitions', extras.createMetafieldDefinition);
router.delete('/metafields/:metafieldId', extras.deleteMetafield);
router.post('/upload-image', extras.uploadImage);

// Wildcard /:id routes
router.post('/:id/duplicate', extras.duplicateProduct);
router.post('/:id/inventory', extras.setInventory);
router.post('/:id/publish', extras.publishProductChannels);
router.post('/:id/variants', extras.addVariant);
router.get('/:id', controller.getProduct);
router.put('/:id', controller.updateProduct);
router.delete('/:id', controller.deleteProduct);

// Root CRUD
router.post('/', controller.createProduct);

export default router;
