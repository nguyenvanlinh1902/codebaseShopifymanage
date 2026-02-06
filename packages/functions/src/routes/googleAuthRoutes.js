import {Router} from 'express';
import * as googleAuthController from '../controllers/googleAuthController.js';

const router = new Router();

router.get('/auth-url', googleAuthController.getGoogleAuthUrl);
router.post('/exchange', googleAuthController.exchangeGoogleCode);
router.post('/exchange-temp', googleAuthController.exchangeGoogleCodeTemp);
router.get('/status', googleAuthController.checkGoogleAuth);
router.post('/disconnect', googleAuthController.disconnectGoogle);
router.post('/disconnect-account', googleAuthController.disconnectAccount);
router.post('/bulk-disconnect-accounts', googleAuthController.bulkDisconnectAccounts);
router.get('/picker-token', googleAuthController.getPickerToken);
router.get('/account-token', googleAuthController.getAccountToken);
router.get('/connected-accounts', googleAuthController.getConnectedAccounts);

export default router;
