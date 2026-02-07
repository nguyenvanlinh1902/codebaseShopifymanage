import {Router} from 'express';
import * as authController from '../controllers/authController.js';
import {authentication} from '../middleware/authentication.js';

const router = new Router();

// Public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.use(authentication);
router.post('/logout', authController.logout);

export default router;
