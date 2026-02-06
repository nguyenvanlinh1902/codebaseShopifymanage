import {Router} from 'express';
import * as trackingController from '../controllers/trackingController.js';
import * as trackingImportController from '../controllers/trackingImportController.js';

const router = new Router();

router.post('/update', trackingController.updateTracking);
router.get('/preview', trackingController.previewTracking);
router.get('/fulfillments', trackingController.getOrderFulfillments);

// Import routes
router.post('/upload-excel', trackingImportController.uploadAndImport);
router.get('/import-history', trackingImportController.getImportHistory);
router.get('/template', trackingImportController.downloadTemplate);
router.get('/imports/:importId', trackingImportController.getImportDetails);

export default router;
