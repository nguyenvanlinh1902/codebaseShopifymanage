import {Router} from 'express';
import * as draftOrderController from '../controllers/draft-order-controller.js';
import * as bulkActions from '../controllers/draft-order/bulk-actions-handler.js';

const router = new Router();

router.get('/', draftOrderController.listDraftOrders);
router.post('/', draftOrderController.createDraftOrder);
router.get('/products', draftOrderController.searchProducts);
router.get('/products/:productId/variants', draftOrderController.loadMoreVariants);
router.get('/customers', draftOrderController.searchCustomers);

// Bulk actions — MUST be registered before /:id to avoid route collision
router.post('/bulk-duplicate', bulkActions.bulkDuplicate);
router.post('/bulk-complete', bulkActions.bulkComplete);

router.get('/:id', draftOrderController.getDraftOrder);
router.put('/:id', draftOrderController.updateDraftOrder);

export default router;
