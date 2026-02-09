import {Router} from 'express';
import * as authController from '../controllers/authController.js';

const router = new Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

export default router;
