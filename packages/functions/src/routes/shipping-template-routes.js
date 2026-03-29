import {Router} from 'express';
import * as controller from '../controllers/shipping-template-controller.js';
import * as orderLimitController from '../controllers/order-limit-controller.js';

const router = new Router();

// Template CRUD
router.get('/templates', controller.listTemplates);
router.post('/templates', controller.createTemplate);
router.get('/templates/:id', controller.getTemplate);
router.patch('/templates/:id', controller.updateTemplateMeta);
router.delete('/templates/:id', controller.deleteTemplate);
router.post('/templates/:id/recapture', controller.recaptureTemplate);

// Store rates (live from Shopify)
router.get('/stores/:shopDomain/rates', controller.getStoreRates);
router.put('/stores/:shopDomain/rates', controller.updateStoreRates);

// Debug matching
router.get('/debug-match/:templateId/:shopDomain', controller.debugMatch);

// Bulk apply
router.post('/bulk-apply', controller.bulkApply);
router.get('/bulk-apply/:jobId', controller.getJobStatus);

// Order limits
router.get('/order-limits', orderLimitController.listOrderLimits);
router.post('/order-limits', orderLimitController.createOrderLimit);
router.patch('/order-limits/:id', orderLimitController.updateOrderLimit);
router.delete('/order-limits/:id', orderLimitController.deleteOrderLimit);
router.post('/order-limits/:id/reset', orderLimitController.resetOrderLimit);
router.post('/order-limits/:id/toggle', orderLimitController.toggleOrderLimit);

export default router;
