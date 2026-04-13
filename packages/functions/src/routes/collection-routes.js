/**
 * Collection routes — Express Router for /api/collections.
 */

import {Router} from 'express';
import * as controller from '../controllers/collection-controller.js';

const router = new Router();

router.get('/list', controller.list);
router.get('/publications', controller.getPublications);
router.get('/search-products', controller.searchProducts);
router.get('/:id', controller.getById);
router.get('/:id/publications', controller.getCollectionPublications);
router.put('/:id/publish', controller.updatePublishing);
router.post('/upload-image', controller.uploadImage);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/products', controller.addProducts);
router.delete('/:id/products', controller.removeProducts);

export default router;
