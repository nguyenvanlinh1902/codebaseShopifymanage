import {Router} from 'express';
import * as storeController from '../controllers/storeController.js';

const router = new Router();

router.get('/', storeController.getStores);
router.get('/niches', storeController.getNiches);
router.get('/:storeId', storeController.getStore);
router.put('/:storeId', storeController.updateStore);
router.post('/bulk-delete', storeController.bulkDeleteStores);
router.delete('/:storeId', storeController.deleteStore);

export default router;
