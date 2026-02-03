import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import * as emailService from '@functions/services/emailService';
import * as shopifySyncService from '@functions/services/shopifySyncService';
import * as organizationRepository from '@functions/repositories/organizationRepository';

const app = new Koa();
app.proxy = true;

// Raw body parser for webhook signature verification
app.use(
  bodyParser({
    enableTypes: ['json', 'text'],
    extendTypes: {
      text: ['application/json']
    }
  })
);

const router = new Router({prefix: '/webhooks/chatty'});

/**
 * POST /webhooks/chatty/email/inbound
 * Inbound email webhook (from Postmark/SendGrid)
 */
router.post('/email/inbound', async ctx => {
  try {
    const signature = ctx.headers['x-postmark-signature'] || ctx.headers['x-sendgrid-signature'];
    const provider = ctx.headers['x-postmark-signature'] ? 'postmark' : 'sendgrid';

    // Verify webhook signature
    if (!emailService.verifyWebhookSignature(ctx.request.body, signature, provider)) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Invalid webhook signature'};
      return;
    }

    // Parse email data
    const emailData = emailService.parseEmailWebhook(ctx.request.body, provider);

    // Process inbound email
    const result = await emailService.processInboundEmail(emailData);

    console.log(
      `Processed inbound email: ${result.isNewTicket ? 'New ticket' : 'Reply to'} #${result.ticket.number}`
    );

    ctx.body = {
      success: true,
      data: {
        ticketId: result.ticket.id,
        ticketNumber: result.ticket.number,
        isNewTicket: result.isNewTicket
      }
    };
  } catch (error) {
    console.error('Error processing inbound email:', error);
    ctx.status = error.message === 'Unknown recipient address' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /webhooks/chatty/email/delivery
 * Email delivery status webhook
 */
router.post('/email/delivery', async ctx => {
  try {
    const {MessageID, Type, RecordType, Email, ErrorCode, Description} = ctx.request.body;

    console.log(`Email delivery event: ${RecordType || Type} for ${Email}`);

    // TODO: Update message delivery status in database
    // For MVP, just log the event

    ctx.body = {success: true};
  } catch (error) {
    console.error('Error processing delivery webhook:', error);
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /webhooks/chatty/shopify/:topic
 * Shopify webhook handler
 */
router.post('/shopify/:topic', async ctx => {
  try {
    const {topic} = ctx.params;
    const shopDomain = ctx.headers['x-shopify-shop-domain'];
    const hmacHeader = ctx.headers['x-shopify-hmac-sha256'];

    // Get raw body for verification
    const rawBody = JSON.stringify(ctx.request.body);

    // Find organization by Shopify domain
    const organization = await organizationRepository.getByShopifyDomain(shopDomain);
    if (!organization) {
      console.log(`Webhook received for unknown shop: ${shopDomain}`);
      ctx.status = 200; // Return 200 to prevent retries
      ctx.body = {success: false, error: 'Unknown shop'};
      return;
    }

    // Verify webhook HMAC
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && !shopifySyncService.verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret)) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Invalid webhook signature'};
      return;
    }

    const data = ctx.request.body;

    // Process based on topic
    switch (topic) {
      case 'customers/create':
      case 'customers/update':
        await shopifySyncService.syncCustomer(organization.id, data);
        console.log(`Synced customer ${data.id} for ${shopDomain}`);
        break;

      case 'orders/create':
      case 'orders/updated':
        await shopifySyncService.syncOrder(organization.id, data);
        console.log(`Synced order ${data.id} for ${shopDomain}`);
        break;

      case 'fulfillments/create':
      case 'fulfillments/update':
        await shopifySyncService.syncFulfillment(organization.id, data);
        console.log(`Synced fulfillment for order ${data.order_id} for ${shopDomain}`);
        break;

      case 'app/uninstalled':
        // Handle app uninstall - mark organization as disconnected
        await organizationRepository.update(organization.id, {
          shopifyToken: null,
          'onboardingStatus.shopifyConnected': false
        });
        console.log(`App uninstalled for ${shopDomain}`);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic} for ${shopDomain}`);
    }

    ctx.body = {success: true};
  } catch (error) {
    console.error(`Error processing Shopify webhook:`, error);
    // Return 200 to prevent retries for non-recoverable errors
    ctx.status = 200;
    ctx.body = {success: false, error: error.message};
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

export default app;
