import {Router} from 'express';
import {verifyWebhookHmac} from '../middleware/verifyWebhookHmac.js';
import * as gdprController from '../controllers/gdprController.js';

// eslint-disable-next-line new-cap
const router = Router();

/**
 * GDPR webhook validation handler
 * Shopify sends GET requests to validate endpoints
 * Must return 401 to indicate HMAC authentication is required
 */
const validateEndpoint = (_req, res) => {
  res.status(401).json({
    success: false,
    error: 'Unauthorized - HMAC verification required'
  });
};

// GET handlers for Shopify endpoint validation
router.get('/customers-data-request', validateEndpoint);
router.get('/customers-redact', validateEndpoint);
router.get('/shop-redact', validateEndpoint);

// POST handlers with HMAC verification
router.post('/customers-data-request', verifyWebhookHmac, gdprController.handleCustomerDataRequest);
router.post('/customers-redact', verifyWebhookHmac, gdprController.handleCustomerRedact);
router.post('/shop-redact', verifyWebhookHmac, gdprController.handleShopRedact);

export default router;
