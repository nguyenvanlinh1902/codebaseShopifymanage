import {Router} from 'express';
import * as controller from '../controllers/shipping-template-controller.js';

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

export default router;
