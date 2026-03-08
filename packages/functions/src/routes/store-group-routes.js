import {Router} from 'express';
import * as storeGroupController from '../controllers/storeGroupController.js';

const router = new Router();

router.get('/', storeGroupController.getGroups);
router.post('/', storeGroupController.createGroup);
router.put('/:id', storeGroupController.updateGroup);
router.delete('/:id', storeGroupController.deleteGroup);

export default router;
