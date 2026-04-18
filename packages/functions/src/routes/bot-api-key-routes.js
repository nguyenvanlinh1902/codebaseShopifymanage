import {Router} from 'express';
import * as controller from '../controllers/bot-api-key-controller.js';
import {requireAdmin} from '../middleware/require-admin.js';

const router = new Router();
router.use(requireAdmin);

router.get('/', controller.listKeys);
router.post('/', controller.createKey);
router.post('/:id/revoke', controller.revokeKey);

export default router;
