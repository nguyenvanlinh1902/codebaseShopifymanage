import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import {jwtAuth, optionalAuth} from '@functions/helpers/authMiddleware';
import createErrorHandler from '@functions/middleware/errorHandler';

// Import route handlers
import authHandler from './authHandler';
import ticketHandler from './ticketHandler';
import customerHandler from './customerHandler';
import teamHandler from './teamHandler';
import tagHandler from './tagHandler';
import settingsHandler from './settingsHandler';
import shopifyAuthHandler from './shopifyAuthHandler';

const app = new Koa();
app.proxy = true;

// Middleware
app.use(createErrorHandler());
app.use(
  cors({
    origin: '*', // Configure properly in production
    credentials: true
  })
);
app.use(bodyParser());

// Create main router
const router = new Router({prefix: '/api/v1/chatty'});

// Health check
router.get('/health', ctx => {
  ctx.body = {success: true, message: 'Chatty API is running', timestamp: new Date().toISOString()};
});

// Public routes (no auth required)
router.use(authHandler.routes());

// Shopify OAuth callback (public - called by Shopify redirect)
router.get('/shopify/callback', async ctx => {
  const {shop, code, state} = ctx.query;
  const shopifyAuthService = (await import('../../services/shopifyAuthService')).default;
  const shopifySyncService = (await import('../../services/shopifySyncService')).default;

  if (!shop || !code || !state) {
    ctx.redirect(`${process.env.FRONTEND_URL}/settings/shopify?error=missing_params`);
    return;
  }

  const result = await shopifyAuthService.exchangeCodeForToken({shop, code, state});

  if (!result.success) {
    ctx.redirect(`${process.env.FRONTEND_URL}/settings/shopify?error=${encodeURIComponent(result.error)}`);
    return;
  }

  // Trigger initial sync in background
  shopifySyncService.triggerInitialSync(result.data.organizationId, shop).catch(console.error);
  ctx.redirect(`${process.env.FRONTEND_URL}/settings/shopify?connected=true`);
});

// Protected routes (auth required)
const protectedRouter = new Router();
protectedRouter.use(jwtAuth());
protectedRouter.use(ticketHandler.routes());
protectedRouter.use(customerHandler.routes());
protectedRouter.use(teamHandler.routes());
protectedRouter.use(tagHandler.routes());
protectedRouter.use(settingsHandler.routes());
protectedRouter.use(shopifyAuthHandler.routes());

router.use(protectedRouter.routes());

// Apply routes to app
app.use(router.routes());
app.use(router.allowedMethods());

// Error handling
app.on('error', err => {
  console.error('Chatty API Error:', err);
});

export default app;
