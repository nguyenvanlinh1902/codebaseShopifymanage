import {Router} from 'express';
import * as oauthController from '../controllers/oauthController.js';

const router = new Router();

router.post('/auth-url', oauthController.getAuthUrl);
router.post('/callback', oauthController.handleCallback);

export default router;
