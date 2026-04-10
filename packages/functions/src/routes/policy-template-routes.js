import {Router} from 'express';
import * as controller from '../controllers/policy-template-controller.js';

const router = new Router();

router.get('/', controller.getTemplates);
router.put('/', controller.saveTemplates);
router.delete('/:type', controller.deleteTemplate);

export default router;
