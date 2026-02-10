import {Router} from 'express';
import {verifyWebhookHmac} from '../middleware/verifyWebhookHmac.js';
import * as gdprController from '../controllers/gdprController.js';

const router = Router();

// All GDPR endpoints require webhook HMAC verification
router.post('/customers-data-request', verifyWebhookHmac, gdprController.handleCustomerDataRequest);
router.post('/customers-redact', verifyWebhookHmac, gdprController.handleCustomerRedact);
router.post('/shop-redact', verifyWebhookHmac, gdprController.handleShopRedact);

export default router;
