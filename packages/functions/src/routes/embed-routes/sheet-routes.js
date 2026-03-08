import {Router} from 'express';
import * as sheetController from '../../controllers/sheetController.js';

const router = new Router();

// GET routes
router.get('/', sheetController.getSheets);
router.get('/:sheetId/tabs', sheetController.getSheetTabs);
router.get('/:sheetId', sheetController.getSheet);

// POST routes — inject storeId from session
router.post('/', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.body.storeId || req.store.id;
  }
  return sheetController.addSheetFromPicker(req, res);
});

export default router;
