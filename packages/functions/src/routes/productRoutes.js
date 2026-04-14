import {Router} from 'express';
import * as productImportController from '../controllers/productImportController.js';
import {directImport} from '../controllers/product-import/direct-import-handler.js';

const router = new Router();

router.post('/upload-csv', productImportController.uploadAndImport);
router.post('/direct-import', directImport);
router.get('/import-history', productImportController.getImportHistory);
router.get('/successful-imports', productImportController.getSuccessfulImports);
router.get('/template', productImportController.downloadTemplate);
router.get('/imports/:importId', productImportController.getImportDetails);
router.post('/imports/:importId/retry', productImportController.retryImport);

export default router;
