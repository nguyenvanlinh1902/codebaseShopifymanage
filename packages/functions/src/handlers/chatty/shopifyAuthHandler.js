import Router from 'koa-router';
import shopifyAuthService from '../../services/shopifyAuthService';
import shopifySyncService from '../../services/shopifySyncService';
import {getOrganizationId} from '../../helpers/authMiddleware';

const router = new Router({prefix: '/shopify'});

/**
 * @route GET /api/v1/chatty/shopify/auth
 * @desc Initiate Shopify OAuth flow
 * @access Private (JWT required)
 */
router.get('/auth', async ctx => {
  const {shop} = ctx.query;
  const organizationId = getOrganizationId(ctx);

  if (!shop) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: 'Shop domain is required'
    };
    return;
  }

  const redirectUri = `${process.env.APP_URL}/api/v1/chatty/shopify/callback`;

  const result = await shopifyAuthService.getAuthorizationUrl({
    shop,
    organizationId,
    redirectUri
  });

  if (!result.success) {
    ctx.status = 400;
    ctx.body = result;
    return;
  }

  ctx.body = {
    success: true,
    data: {
      authUrl: result.data
    }
  };
});

/**
 * @route GET /api/v1/chatty/shopify/callback
 * @desc Handle Shopify OAuth callback
 * @access Public (redirected from Shopify)
 */
router.get('/callback', async ctx => {
  const {shop, code, state} = ctx.query;

  if (!shop || !code || !state) {
    ctx.redirect(`${process.env.FRONTEND_URL}/settings/shopify?error=missing_params`);
    return;
  }

  // TODO: Verify HMAC signature for additional security

  const result = await shopifyAuthService.exchangeCodeForToken({
    shop,
    code,
    state
  });

  if (!result.success) {
    ctx.redirect(
      `${process.env.FRONTEND_URL}/settings/shopify?error=${encodeURIComponent(result.error)}`
    );
    return;
  }

  // Trigger initial sync in background
  shopifySyncService
    .triggerInitialSync(result.data.organizationId, shop)
    .catch(err => console.error('Initial sync trigger error:', err));

  // Redirect back to app
  ctx.redirect(`${process.env.FRONTEND_URL}/settings/shopify?connected=true`);
});

/**
 * @route GET /api/v1/chatty/shopify/status
 * @desc Get Shopify connection status
 * @access Private (JWT required)
 */
router.get('/status', async ctx => {
  const organizationId = getOrganizationId(ctx);

  const result = await shopifyAuthService.getConnectionStatus(organizationId);

  if (!result.success) {
    ctx.status = 400;
    ctx.body = result;
    return;
  }

  ctx.body = result;
});

/**
 * @route POST /api/v1/chatty/shopify/disconnect
 * @desc Disconnect Shopify from organization
 * @access Private (JWT required)
 */
router.post('/disconnect', async ctx => {
  const organizationId = getOrganizationId(ctx);

  const result = await shopifyAuthService.disconnect(organizationId);

  if (!result.success) {
    ctx.status = 400;
    ctx.body = result;
    return;
  }

  ctx.body = {
    success: true,
    message: 'Shopify disconnected successfully'
  };
});

/**
 * @route POST /api/v1/chatty/shopify/sync
 * @desc Trigger manual sync
 * @access Private (JWT required)
 */
router.post('/sync', async ctx => {
  const organizationId = getOrganizationId(ctx);

  // Get connection status first
  const statusResult = await shopifyAuthService.getConnectionStatus(organizationId);
  if (!statusResult.success || !statusResult.data.isConnected) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: 'Shopify not connected'
    };
    return;
  }

  // Trigger sync
  shopifySyncService
    .triggerInitialSync(organizationId, statusResult.data.shop)
    .catch(err => console.error('Manual sync error:', err));

  ctx.body = {
    success: true,
    message: 'Sync started'
  };
});

export default router;
