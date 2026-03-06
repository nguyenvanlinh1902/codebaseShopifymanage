import {Router} from 'express';
import * as multiAppAuthController from '../controllers/multi-app-auth-controller.js';

const router = new Router();

// OAuth redirect flow — long-lived token
router.get('/shopify', multiAppAuthController.initiateInstall);
router.get('/shopify/callback', multiAppAuthController.handleCallback);

export default router;
