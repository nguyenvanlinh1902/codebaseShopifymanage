import {Router} from 'express';
import * as sheetController from '../controllers/sheetController.js';

const router = new Router();

router.post('/add', sheetController.addSheetFromPicker);
router.post('/auth-url', sheetController.getAuthUrl);
router.post('/connect', sheetController.connectSheet);
router.get('/preview', sheetController.previewSheetData);
router.get('/', sheetController.getSheets);
router.get('/:sheetId/tabs', sheetController.getSheetTabs);
router.get('/:sheetId', sheetController.getSheet);
router.delete('/:sheetId', sheetController.deleteSheet);

export default router;
