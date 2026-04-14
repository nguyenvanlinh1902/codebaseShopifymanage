import {Router} from 'express';
import * as productImportController from '../../controllers/productImportController.js';

const router = new Router();

// Upload CSV with auto-injection of storeIds from session
router.post(
  '/upload-csv',
  (req, res, next) => {
    // Embedded: auto-inject storeIds from session
    if (req.store && !req.body.storeIds) {
      req.body.storeIds = [req.store.id];
    }
    next();
  },
  productImportController.uploadAndImport
);

router.get('/list', productImportController.getProducts);
router.get('/template', productImportController.downloadTemplate);
router.get('/successful-imports', productImportController.getSuccessfulImports);
router.get('/import-status/:jobId', productImportController.getImportStatus);
router.get('/import-history', productImportController.getImportHistory);

export default router;
