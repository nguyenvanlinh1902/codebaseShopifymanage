import {Router} from 'express';
import {
  delegateShopifyTokens,
  delegateGmailTokens,
  delegateOutlookTokens
} from '../controllers/bot-delegation-controller.js';

const router = new Router();

router.post('/tokens/shopify', delegateShopifyTokens);
router.post('/tokens/gmail', delegateGmailTokens);
router.post('/tokens/outlook', delegateOutlookTokens);

export default router;
