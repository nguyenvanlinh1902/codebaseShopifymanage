import {Router} from 'express';
import * as multiAppAuthController from '../controllers/multi-app-auth-controller.js';

const router = new Router();

// OAuth redirect flow — long-lived token
router.get('/shopify', multiAppAuthController.initiateInstall);
router.get('/shopify/callback', multiAppAuthController.handleCallback);

// Webhook check & fix
router.get('/webhooks', multiAppAuthController.checkWebhooks);
router.post('/webhooks/fix', multiAppAuthController.fixWebhooks);
router.get('/webhooks/all', multiAppAuthController.checkAllWebhooks);
router.post('/webhooks/fix-all', multiAppAuthController.fixAllWebhooks);
router.post('/webhooks/register', multiAppAuthController.registerWebhook);

// Store OAuth scopes
router.get('/scopes', multiAppAuthController.getStoreScopes);

export default router;
