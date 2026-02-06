import {Router} from 'express';
import * as productImportController from '../controllers/productImportController.js';

const router = new Router();

router.post('/upload-csv', productImportController.uploadAndImport);
router.get('/import-history', productImportController.getImportHistory);
router.get('/successful-imports', productImportController.getSuccessfulImports);
router.get('/list', productImportController.getProducts);
router.get('/template', productImportController.downloadTemplate);
router.get('/queue-stats', productImportController.getQueueStats);
router.post('/process-queue', productImportController.processQueueManual);
router.get('/imports/:importId', productImportController.getImportDetails);

export default router;
