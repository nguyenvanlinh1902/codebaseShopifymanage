import {Router} from 'express';
import * as draftOrderController from '../controllers/draft-order-controller.js';

const router = new Router();

router.get('/', draftOrderController.listDraftOrders);
router.post('/', draftOrderController.createDraftOrder);
router.get('/products', draftOrderController.searchProducts);
router.get('/customers', draftOrderController.searchCustomers);
router.get('/:id', draftOrderController.getDraftOrder);
router.put('/:id', draftOrderController.updateDraftOrder);

export default router;
