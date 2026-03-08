import {Router} from 'express';
import * as storeController from '../controllers/storeController.js';
import * as storeBalanceController from '../controllers/store-balance-controller.js';

const router = new Router();

router.get('/', storeController.getStores);
router.get('/niches', storeController.getNiches);
router.get('/balances', storeBalanceController.getAllBalances);
router.get('/:storeId', storeController.getStore);
router.put('/:storeId', storeController.updateStore);
router.post('/bulk-delete', storeController.bulkDeleteStores);
router.delete('/:storeId', storeController.deleteStore);

export default router;
