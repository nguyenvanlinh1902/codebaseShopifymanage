import {Router} from 'express';
import * as sheetController from '../../controllers/sheetController.js';

const router = new Router();

// GET routes
router.get('/', sheetController.getSheets);
router.get('/:sheetId/tabs', sheetController.getSheetTabs);
router.get('/:sheetId', sheetController.getSheet);

// POST routes
router.post('/', sheetController.addSheetFromPicker);

export default router;
