import {Router} from 'express';
import * as themeController from '../controllers/themeController.js';

const router = new Router();

router.get('/', themeController.getThemes);
router.post('/import', themeController.importTheme);
router.put('/:themeId/publish', themeController.publishTheme);
router.delete('/:themeId', themeController.deleteTheme);

// Imported theme records (saved on our server)
router.get('/imported', themeController.getImportedThemes);
router.delete('/imported/:recordId', themeController.deleteImportedTheme);
router.post('/imported/:recordId/reimport', themeController.reimportTheme);

export default router;
