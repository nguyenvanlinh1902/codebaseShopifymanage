import {Router} from 'express';
import * as shopifyInstallController from '../controllers/shopifyInstallController.js';

const router = new Router();

// Public routes (no auth required)
router.get('/', shopifyInstallController.initiateInstall);
router.get('/callback', shopifyInstallController.handleCallback);
router.post('/webhook/app/uninstalled', shopifyInstallController.handleUninstall);

export default router;
