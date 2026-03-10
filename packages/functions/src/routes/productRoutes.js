import {Router} from 'express';
import * as productImportController from '../controllers/productImportController.js';
import {directImport} from '../controllers/product-import/direct-import-handler.js';

const router = new Router();

router.post('/upload-csv', productImportController.uploadAndImport);
router.post('/direct-import', directImport);
router.get('/import-history', productImportController.getImportHistory);
router.get('/successful-imports', productImportController.getSuccessfulImports);
router.get('/list', productImportController.getProducts);
router.get('/filter-options', productImportController.getProductFilterOptions);
router.get('/template', productImportController.downloadTemplate);
router.get('/imports/:importId', productImportController.getImportDetails);
router.get('/stuck-imports', productImportController.getStuckImports);
router.post('/imports/:importId/retry', productImportController.retryImport);
router.post('/process-queue', productImportController.processQueueManual);

export default router;
