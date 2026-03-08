import {Router} from 'express';
import * as userController from '../controllers/user-controller.js';

const router = new Router();

router.get('/me', userController.getMe);
router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deactivateUser);

export default router;
