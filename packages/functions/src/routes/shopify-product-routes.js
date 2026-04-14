/**
 * Shopify Product routes — Express Router for /api/shopify-products.
 */

import {Router} from 'express';
import * as controller from '../controllers/shopify-product-controller.js';

const router = new Router();

router.get('/list', controller.list);
router.get('/collections', controller.listCollections);
router.post('/bulk-action', controller.bulkAction);

export default router;
