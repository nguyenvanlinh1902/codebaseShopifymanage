import {Router} from 'express';
import {verifyShopifySession} from '../middleware/verifyShopifySession.js';
import * as storeManagementController from '../controllers/storeManagementController.js';

const router = Router();

// All routes require Shopify session token
router.use(verifyShopifySession);

router.get('/details', storeManagementController.getStoreDetails);
router.put('/settings', storeManagementController.updateStoreSettings);
router.get('/status', storeManagementController.getStoreStatus);
router.post('/disconnect', storeManagementController.disconnectStore);

export default router;
